import { describe, expect, it } from 'vitest';
import { AtsAnalyzer } from '../src/domain/services/AtsAnalyzer';
import { fullProfile, minimalProfile } from './fixtures';

describe('AtsAnalyzer v2', () => {
  const analyzer = new AtsAnalyzer();

  it('extrai keywords, hard skills e senioridade da vaga', () => {
    const analysis = analyzer.analyzeJob({
      title: 'Desenvolvedor Backend Sênior',
      description: 'Experiência com Node.js, TypeScript e PostgreSQL.',
    });

    expect(analysis.keywords).toContain('node.js');
    expect(analysis.hardSkills).toEqual(
      expect.arrayContaining(['Node.js', 'TypeScript', 'PostgreSQL']),
    );
    expect(analysis.seniority).toBe('Sênior');
  });

  it('só conta keywords com evidência no perfil (sem inventar)', () => {
    const analysis = analyzer.analyzeJob({
      description: 'Buscamos TypeScript, Node.js, Kubernetes e Docker.',
    });
    const report = analyzer.score(fullProfile(), analysis);

    expect(report.matchedKeywords).toEqual(
      expect.arrayContaining(['typescript', 'node.js']),
    );
    expect(report.missingKeywords).toEqual(expect.arrayContaining(['kubernetes']));
    expect(report.matchedKeywords).not.toContain('kubernetes');
  });

  it('retorna score, status e breakdown de 6 dimensões', () => {
    const report = analyzer.score(
      fullProfile(),
      analyzer.analyzeJob({ description: 'Node.js e TypeScript' }),
    );

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.breakdown).toHaveProperty('keywords');
    expect(report.breakdown).toHaveProperty('experience');
    expect(report.breakdown).toHaveProperty('technicalSkills');
    expect(report.breakdown).toHaveProperty('structure');
    expect(report.breakdown).toHaveProperty('achievements');
    expect(report.breakdown).toHaveProperty('readability');
    expect(['PASSED', 'NEEDS_IMPROVEMENT', 'INSUFFICIENT_DATA']).toContain(report.status);
  });

  it('perfil vazio recebe score baixo, seções fracas e recomendações', () => {
    const report = analyzer.score(
      minimalProfile(),
      analyzer.analyzeJob({ description: 'React, Node.js' }),
    );

    expect(report.score).toBeLessThan(50);
    expect(report.weakSections.length).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('detecta keyword stuffing penalizando a legibilidade', () => {
    const stuffed = {
      ...fullProfile(),
      summary: 'Node Node Node Node Node Node developer',
    };
    const normal = analyzer.score(fullProfile(), analyzer.analyzeJob(null));
    const bad = analyzer.score(stuffed, analyzer.analyzeJob(null));
    expect(bad.breakdown.readability).toBeLessThan(normal.breakdown.readability);
  });
});
