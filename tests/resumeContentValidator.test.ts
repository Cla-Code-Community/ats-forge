import { describe, expect, it } from 'vitest';
import { NormalizedProfile } from '../src/domain/entities/NormalizedProfile';
import { ResumeContentValidator } from '../src/application/ai/ResumeContentValidator';
import { EnhancedContentAI } from '../src/application/ai/aiSchemas';
import { fullProfile } from './fixtures';

const validator = new ResumeContentValidator();

function emptyRewrites(summary: string): EnhancedContentAI {
  return { summary, experiences: [], projects: [] };
}

describe('ResumeContentValidator', () => {
  it('aceita um resumo que usa apenas tecnologias e números do perfil', () => {
    const profile = fullProfile();
    const content = emptyRewrites('Engenheira de Software com TypeScript e Node.js, com redução de 30% no tempo de resposta.');
    const result = validator.reconcile(profile, content);
    expect(result.acceptedSummary).toBe(true);
    expect(result.profile.summary).toContain('TypeScript');
    expect(result.warnings).toHaveLength(0);
  });

  it('descarta resumo que inventa uma tecnologia sem evidência', () => {
    const profile = fullProfile();
    const content = emptyRewrites('Especialista em Kubernetes e Rust de nível avançado.');
    const result = validator.reconcile(profile, content);
    expect(result.acceptedSummary).toBe(false);
    expect(result.profile.summary).toBe(profile.summary);
    expect(result.warnings.join(' ')).toMatch(/tecnologia sem evidência/i);
  });

  it('descarta resumo que inventa um número/métrica', () => {
    const profile = fullProfile();
    const content = emptyRewrites('Engenheira com TypeScript e aumento de 99% na performance.');
    const result = validator.reconcile(profile, content);
    expect(result.acceptedSummary).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/número sem origem/i);
  });

  it('reescreve highlights de experiência preservando os números de origem', () => {
    const profile = fullProfile();
    const content: EnhancedContentAI = {
      summary: '',
      experiences: [{ index: 0, highlights: ['Desenvolvi APIs REST em Node.js e TypeScript', 'Reduzi o tempo de resposta em 30%'] }],
      projects: [],
    };
    const result = validator.reconcile(profile, content);
    expect(result.rewrittenExperiences).toBe(1);
    expect(result.profile.experience[0].highlights).toContain('Reduzi o tempo de resposta em 30%');
  });

  it('remove apenas o bullet com número inventado e mantém os válidos', () => {
    const profile = fullProfile();
    const content: EnhancedContentAI = {
      summary: '',
      experiences: [{ index: 0, highlights: ['Implementei pipelines CI/CD', 'Aumentei a cobertura para 95%'] }],
      projects: [],
    };
    const result = validator.reconcile(profile, content);
    const highlights = result.profile.experience[0].highlights ?? [];
    expect(highlights).toContain('Implementei pipelines CI/CD');
    expect(highlights.join(' ')).not.toContain('95%');
    expect(result.warnings.join(' ')).toMatch(/número sem origem/i);
  });

  it('nunca altera empresa, cargo ou datas', () => {
    const profile = fullProfile();
    const original = profile.experience[0];
    const content: EnhancedContentAI = {
      summary: '',
      experiences: [{ index: 0, highlights: ['Atuei com Node.js'] }],
      projects: [],
    };
    const result = validator.reconcile(profile, content);
    expect(result.profile.experience[0].company).toBe(original.company);
    expect(result.profile.experience[0].role).toBe(original.role);
    expect(result.profile.experience[0].period).toBe(original.period);
  });

  it('ignora índice fora do intervalo', () => {
    const profile: NormalizedProfile = fullProfile();
    const content: EnhancedContentAI = {
      summary: '',
      experiences: [{ index: 99, highlights: ['qualquer coisa'] }],
      projects: [],
    };
    const result = validator.reconcile(profile, content);
    expect(result.rewrittenExperiences).toBe(0);
  });
});
