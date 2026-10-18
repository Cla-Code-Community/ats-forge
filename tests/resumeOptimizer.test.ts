import { describe, expect, it } from 'vitest';
import { ResumeOptimizer } from '../src/domain/services/ResumeOptimizer';
import { minimalProfile, richProfile } from './fixtures';

describe('ResumeOptimizer', () => {
  const optimizer = new ResumeOptimizer();

  it('atinge ATS Score >= 80 e status PASSED para um perfil rico', () => {
    const { report } = optimizer.optimize(richProfile(), {
      title: 'Engenheiro Backend',
      description: 'Node.js, TypeScript, PostgreSQL, Docker, Redis, microservices',
    });

    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.status).toBe('PASSED');
  });

  it('gera um resumo profissional quando ausente (a partir de evidências)', () => {
    const { profile } = optimizer.optimize(richProfile(), null);
    expect(profile.summary && profile.summary.length).toBeGreaterThan(20);
    // deriva de techs reais do perfil
    expect(profile.summary).toMatch(/TypeScript|Node\.js|Java/);
  });

  it('normaliza e deduplica tecnologias nas skills', () => {
    const base = richProfile();
    base.skills.push({ name: 'nodejs' }, { name: 'TS' });
    const { profile } = optimizer.optimize(base, null);
    const names = profile.skills.map((s) => s.name);
    expect(names.filter((n) => n === 'Node.js').length).toBe(1);
    expect(names).not.toContain('nodejs');
    expect(names).not.toContain('TS');
  });

  it('não inventa experiência/projetos para um perfil pobre', () => {
    const { profile, report } = optimizer.optimize(minimalProfile(), null);
    expect(profile.experience).toEqual([]);
    expect(profile.projects).toEqual([]);
    expect(report.status).toBe('INSUFFICIENT_DATA');
  });

  it('para de otimizar assim que atinge o threshold', () => {
    const { report, iterations } = optimizer.optimize(richProfile(), null);
    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(iterations).toBeLessThanOrEqual(6);
  });
});
