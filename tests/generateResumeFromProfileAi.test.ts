import { describe, expect, it } from 'vitest';
import { GenerateResumeFromProfileUseCase } from '../src/application/use-cases/GenerateResumeFromProfileUseCase';
import { ResumeAIService } from '../src/application/ai/ResumeAIService';
import { AICompletionRequest } from '../src/domain/interfaces/IAIProvider';
import { FakeAIProvider, jobAnalysisResponse } from './aiFixtures';
import { fullProfile } from './fixtures';

function aiService(): ResumeAIService {
  const provider = new FakeAIProvider([], (req: AICompletionRequest) => {
    if (req.schemaName === 'job_analysis') return jobAnalysisResponse();
    return {
      summary: 'Engenheira de Software focada em Node.js e TypeScript para APIs escaláveis.',
      experiences: [{ index: 0, highlights: ['Projetei APIs REST em Node.js'] }],
      projects: [],
    };
  });
  return new ResumeAIService(provider, { maxInputChars: 4000, temperature: 0.3 });
}

describe('GenerateResumeFromProfileUseCase + camada de IA', () => {
  it('sem IA injetada: caminho determinístico inalterado (sem "ai" em sourcesUsed)', async () => {
    const useCase = new GenerateResumeFromProfileUseCase();
    const result = await useCase.analyze({ profile: fullProfile(), job: { description: 'Node.js' }, format: 'pdf' });
    expect(result.sourcesUsed).not.toContain('ai');
    expect(result.resume.summary).not.toContain('TypeScript');
  });

  it('com IA injetada: aplica o resumo gerado e marca a fonte "ai"', async () => {
    const useCase = new GenerateResumeFromProfileUseCase(undefined, undefined, undefined, undefined, aiService());
    const result = await useCase.analyze({ profile: fullProfile(), job: { title: 'Backend', description: 'Node.js' }, format: 'pdf' });
    expect(result.sourcesUsed).toContain('ai');
    expect(result.resume.summary).toContain('TypeScript');
    expect(result.atsReport.score).toBeGreaterThanOrEqual(0);
  });

  it('a geração de arquivo ainda funciona com a IA ligada', async () => {
    const useCase = new GenerateResumeFromProfileUseCase(undefined, undefined, undefined, undefined, aiService());
    const result = await useCase.execute({ profile: fullProfile(), job: { description: 'Node.js' }, format: 'md' });
    expect(typeof result.content === 'string' || Buffer.isBuffer(result.content)).toBe(true);
    expect(result.filename.endsWith('.md')).toBe(true);
  });
});
