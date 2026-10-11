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

  it('conta apenas as TECNOLOGIAS da vaga (não palavras genéricas) e cruza com o perfil', () => {
    const analysis = analyzer.analyzeJob({
      description:
        'Buscamos profissional com experiência em desenvolvimento usando Java, Node.js, Kubernetes e Docker.',
    });
    const report = analyzer.score(fullProfile(), analysis);

    // só techs reais da vaga, em nome canônico
    expect(report.matchedKeywords).toEqual(
      expect.arrayContaining(['Node.js']),
    );
    expect(report.missingKeywords).toEqual(
      expect.arrayContaining(['Kubernetes', 'Docker']),
    );
    // palavras genéricas não entram no filtro
    expect(report.matchedKeywords).not.toContain('desenvolvimento');
    expect(report.missingKeywords).not.toContain('experiência');
    expect(report.matchedKeywords).not.toContain('Kubernetes');
  });

  it('explica a aderência por requisito e reduz o peso de uma menção em lista', () => {
    const job = {
      description: 'Requisitos obrigatórios:\n- Experiência com Node.js',
    };
    const listedOnly = {
      ...minimalProfile(),
      skills: [{ name: 'Node.js', source: 'github' as const }],
    };
    const workEvidence = {
      ...listedOnly,
      experience: [
        {
          company: 'Acme',
          role: 'Desenvolvedora',
          stack: ['Node.js'],
          highlights: ['Implementei APIs com Node.js'],
          source: 'candidate' as const,
        },
      ],
    };

    const listedReport = analyzer.score(listedOnly, analyzer.analyzeJob(job));
    const workReport = analyzer.score(workEvidence, analyzer.analyzeJob(job));
    const requirement = workReport.requirements.find((item) =>
      item.technologies.includes('Node.js'),
    );

    expect(listedReport.jobFitScore).toBe(45);
    expect(workReport.jobFitScore).toBe(100);
    expect(requirement?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'candidate',
          evidenceType: 'professional_experience',
          canonicalName: 'Node.js',
          confidence: 1,
          originalExcerpt: expect.stringContaining('Node.js'),
        }),
      ]),
    );
    expect(workReport.jobFitExplanation).toContain('peso 3');
  });

  it('mantém requisitos sem classificação segura para revisão, fora do score', () => {
    const report = analyzer.score(
      fullProfile(),
      analyzer.analyzeJob({ description: 'Node.js e Kubernetes' }),
    );
    const uncertain = report.requirements.find(
      (requirement) => requirement.priority === 'review',
    );

    expect(uncertain?.reviewRequired).toBe(true);
    expect(report.jobFitScore).toBeNull();
  });

  it('junta vaga (java, node, mulesoft) com as techs do perfil (GitHub/LinkedIn)', () => {
    const profile = {
      ...fullProfile(),
      skills: [
        { name: 'Java', category: 'Linguagens' },
        { name: 'Node.js', category: 'Backend' },
      ],
    };
    const analysis = analyzer.analyzeJob({
      title: 'Desenvolvedor Backend',
      description: 'Java, Node.js e MuleSoft para integrações.',
    });
    const report = analyzer.score(profile, analysis);

    expect(report.matchedKeywords.sort()).toEqual(['Java', 'Node.js']);
    expect(report.missingKeywords).toEqual(['MuleSoft']);
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
