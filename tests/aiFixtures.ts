import { AICompletionRequest, AIProvider } from '../src/domain/interfaces/IAIProvider';

export class FakeAIProvider implements AIProvider {
  readonly name: string;
  readonly model = 'fake-model';
  readonly requests: AICompletionRequest[] = [];

  private queue: unknown[];

  constructor(
    responses: unknown[] = [],
    private readonly handler?: (req: AICompletionRequest, index: number) => unknown,
    name = 'fake',
  ) {
    this.queue = [...responses];
    this.name = name;
  }

  async generateJson(request: AICompletionRequest): Promise<unknown> {
    const index = this.requests.length;
    this.requests.push(request);
    if (this.handler) {
      const result = this.handler(request, index);
      if (result instanceof Error) throw result;
      return result;
    }
    if (this.queue.length === 0) throw new Error('FakeAIProvider: sem resposta roteirizada');
    const next = this.queue.shift();
    if (next instanceof Error) throw next;
    return next;
  }
}

export function jobAnalysisResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    role: 'Engenheiro Backend',
    seniority: 'Pleno',
    responsibilities: ['Desenvolver APIs'],
    requiredSkills: ['Node.js', 'TypeScript'],
    preferredSkills: ['Docker'],
    keywords: ['api', 'rest'],
    technicalContext: 'Serviços backend em Node.js.',
    ...overrides,
  };
}
