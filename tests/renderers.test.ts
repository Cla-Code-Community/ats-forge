import { describe, expect, it } from 'vitest';
import { GenerateResumeFromProfileUseCase } from '../src/application/use-cases/GenerateResumeFromProfileUseCase';
import { fullProfile, minimalProfile } from './fixtures';

const useCase = new GenerateResumeFromProfileUseCase();

describe('Resume rendering (end-to-end por formato)', () => {
  it('gera DOCX como Buffer não vazio', async () => {
    const result = await useCase.execute({ profile: fullProfile(), format: 'docx' });
    expect(Buffer.isBuffer(result.content)).toBe(true);
    expect((result.content as Buffer).length).toBeGreaterThan(500);
    expect(result.filename).toMatch(/\.docx$/);
    expect(result.contentType).toContain('wordprocessingml');
  });

  it('gera PDF com texto real (assinatura %PDF)', async () => {
    const result = await useCase.execute({ profile: fullProfile(), format: 'pdf' });
    const buf = result.content as Buffer;
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(result.contentType).toBe('application/pdf');
  });

  it('gera Markdown com as seções esperadas', async () => {
    const result = await useCase.execute({ profile: fullProfile(), format: 'md' });
    const md = result.content as string;
    expect(typeof md).toBe('string');
    expect(md).toContain('# Ana Souza');
    expect(md).toContain('EXPERIÊNCIA PROFISSIONAL');
  });

  it('gera currículo mesmo com perfil mínimo', async () => {
    const result = await useCase.execute({ profile: minimalProfile(), format: 'pdf' });
    expect((result.content as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(result.atsReport.score).toBeGreaterThanOrEqual(0);
  });

  it('inclui o AtsReport no resultado', async () => {
    const result = await useCase.execute({
      profile: fullProfile(),
      job: { description: 'Node.js, TypeScript' },
      format: 'docx',
    });
    expect(result.atsReport.score).toBeGreaterThan(0);
    expect(result.atsReport.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('sanitiza o nome do arquivo', async () => {
    const result = await useCase.execute({
      profile: { ...fullProfile(), name: 'José / Ação' },
      format: 'md',
    });
    expect(result.filename).not.toMatch(/[/\\]/);
  });
});
