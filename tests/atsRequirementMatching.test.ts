import { describe, expect, it } from 'vitest';
import { AtsAnalyzer } from '../src/domain/services/AtsAnalyzer';
import { NormalizedProfile } from '../src/domain/entities/NormalizedProfile';
import { richProfile } from './fixtures';

const analyzer = new AtsAnalyzer();

function backendOnlyProfile(): NormalizedProfile {
  return {
    name: 'Backender',
    headline: 'Engenheiro Backend',
    contact: {},
    experience: [
      {
        company: 'Acme',
        role: 'Engenheiro de Software',
        stack: ['Java', 'Spring Boot', 'Node.js'],
        highlights: ['Desenvolvi APIs REST em Java e Node.js'],
        source: 'manual',
      },
    ],
    education: [],
    skills: [
      { name: 'Java', category: 'Linguagens' },
      { name: 'Spring Boot', category: 'Backend' },
      { name: 'Node.js', category: 'Backend' },
    ],
    projects: [],
    links: [],
    languages: [],
  };
}

describe('AtsAnalyzer — §7A requisito Full Stack', () => {
  const job = {
    title: 'Desenvolvedor Full Stack Pleno',
    description: [
      'Requisitos',
      'Experiência como Desenvolvedor(a) Fullstack Pleno ou em posição similar',
    ].join('\n'),
  };

  it('dá crédito parcial quando há evidência de backend E frontend (revisão por causa da senioridade)', () => {
    const report = analyzer.score(richProfile(), analyzer.analyzeJob(job));
    const req = report.requirements.find((r) => /fullstack/i.test(r.text));
    expect(req).toBeDefined();
    expect(req!.matchStrength).toBeGreaterThanOrEqual(65);
    expect(req!.reviewRequired).toBe(true);
    expect(req!.evidence.length).toBeGreaterThan(0);
  });

  it('não dá crédito de full stack para perfil só de backend', () => {
    const report = analyzer.score(backendOnlyProfile(), analyzer.analyzeJob(job));
    const req = report.requirements.find((r) => /fullstack/i.test(r.text));
    expect(req).toBeDefined();
    expect(req!.matchStrength).toBeLessThan(65);
  });
});

describe('AtsAnalyzer — §10 estrutura não mascara baixa aderência', () => {
  it('limita o ATS Score por um teto derivado da aderência quando a vaga tem requisitos não atendidos', () => {
    const job = {
      description: [
        'Requisitos obrigatórios:',
        '- Experiência com Python',
        '- Experiência com Django',
        '- Experiência com Kubernetes',
      ].join('\n'),
    };
    const report = analyzer.score(richProfile(), analyzer.analyzeJob(job));

    expect(report.jobFitScore).not.toBeNull();
    expect(report.jobFitScore!).toBeLessThan(40);
    expect(report.score).toBeLessThanOrEqual(50 + Math.round(report.jobFitScore! * 0.5));
    expect(report.status).toBe('NEEDS_IMPROVEMENT');
  });

  it('não limita quando a aderência é alta (perfil casa com a vaga)', () => {
    const job = {
      description: [
        'Requisitos obrigatórios:',
        '- Experiência com Node.js',
        '- Experiência com TypeScript',
        '- Experiência com PostgreSQL',
        '- Experiência com Docker',
      ].join('\n'),
    };
    const report = analyzer.score(richProfile(), analyzer.analyzeJob(job));
    expect(report.jobFitScore!).toBeGreaterThanOrEqual(60);
  });
});
