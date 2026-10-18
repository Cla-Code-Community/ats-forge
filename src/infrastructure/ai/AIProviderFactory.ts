import {
  AICompletionRequest,
  AIProvider,
  AIProviderError,
} from '../../domain/interfaces/IAIProvider';
import { AIConfig, AIProviderName } from './aiConfig';
import { GeminiProvider } from './GeminiProvider';
import { logAiEvent } from './aiLogger';
import { OpenAIProvider } from './OpenAIProvider';

export class AIProviderFactory {
  static createNamed(name: AIProviderName, config: AIConfig): AIProvider {
    switch (name) {
      case 'openai':
        return OpenAIProvider.fromConfig(config);
      case 'gemini':
        return GeminiProvider.fromConfig(config);
      default: {
        const exhaustive: never = name;
        throw new AIProviderError('config', `Provedor de IA desconhecido: ${String(exhaustive)}`, 'factory');
      }
    }
  }

  static create(config: AIConfig): AIProvider | null {
    if (!config.enabled || config.provider === 'none') return null;

    const primary = AIProviderFactory.createNamed(config.provider, config);

    const fallbackName = config.fallbackProvider;
    if (!fallbackName) return primary;

    const fallbackKey = fallbackName === 'openai' ? config.openai.apiKey : config.gemini.apiKey;
    if (!fallbackKey) return primary;

    const fallback = AIProviderFactory.createNamed(fallbackName, config);
    return new FallbackAIProvider(primary, fallback);
  }
}

export class FallbackAIProvider implements AIProvider {
  readonly name: string;

  constructor(
    private readonly primary: AIProvider,
    private readonly fallback: AIProvider,
  ) {
    this.name = `${primary.name}->${fallback.name}`;
  }

  get model(): string {
    return this.primary.model;
  }

  async generateJson(request: AICompletionRequest): Promise<unknown> {
    try {
      return await this.primary.generateJson(request);
    } catch (err) {
      if (err instanceof AIProviderError && err.retryable) {
        logAiEvent({
          provider: this.primary.name,
          model: this.primary.model,
          operation: request.schemaName,
          status: 'error',
          errorKind: `${err.kind}:falling_back_to_${this.fallback.name}`,
        });
        return this.fallback.generateJson(request);
      }
      throw err;
    }
  }
}
