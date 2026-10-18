import { GoogleGenAI } from '@google/genai';
import {
  AICompletionRequest,
  AIProvider,
  AIProviderError,
} from '../../domain/interfaces/IAIProvider';
import { AIConfig } from './aiConfig';
import { logAiEvent } from './aiLogger';
import { withRetries } from './aiRetry';

type GenerateContentFn = GoogleGenAI['models']['generateContent'];

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  constructor(
    private readonly models: { generateContent: GenerateContentFn },
    readonly model: string,
    private readonly maxRetries: number,
    private readonly temperatureDefault = 0.3,
  ) {}

  static fromConfig(config: AIConfig): GeminiProvider {
    if (!config.gemini.apiKey) {
      throw new AIProviderError('config', 'GEMINI_API_KEY ausente.', 'gemini');
    }
    const ai = new GoogleGenAI({
      apiKey: config.gemini.apiKey,
      httpOptions: { timeout: config.timeoutMs },
    });
    return new GeminiProvider(ai.models, config.gemini.model, config.maxRetries, config.temperature);
  }

  async generateJson(request: AICompletionRequest): Promise<unknown> {
    const startedAt = Date.now();
    let attempts = 0;
    try {
      const response = await withRetries(
        async (attempt) => {
          attempts = attempt;
          try {
            return await this.models.generateContent({
              model: this.model,
              contents: request.user,
              config: {
                systemInstruction: request.system,
                responseMimeType: 'application/json',
                responseJsonSchema: request.schema,
                temperature: request.temperature ?? this.temperatureDefault,
                abortSignal: request.signal,
              },
            });
          } catch (err) {
            throw mapGeminiError(err, this.name);
          }
        },
        { maxRetries: this.maxRetries },
      );

      const text = response.text;
      if (!text) {
        throw new AIProviderError('invalid_response', 'Resposta vazia do Gemini.', this.name);
      }

      const parsed = safeJsonParse(text, this.name);
      logAiEvent({
        provider: this.name,
        model: this.model,
        operation: request.schemaName,
        status: 'ok',
        latencyMs: Date.now() - startedAt,
        tokens: response.usageMetadata?.totalTokenCount,
        attempts,
      });
      return parsed;
    } catch (err) {
      const mapped = mapGeminiError(err, this.name);
      logAiEvent({
        provider: this.name,
        model: this.model,
        operation: request.schemaName,
        status: 'error',
        latencyMs: Date.now() - startedAt,
        errorKind: mapped.kind,
        attempts,
      });
      throw mapped;
    }
  }
}

function safeJsonParse(content: string, provider: string): unknown {
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new AIProviderError('invalid_response', 'JSON inválido retornado pelo Gemini.', provider, false, err);
  }
}

export function mapGeminiError(err: unknown, provider: string): AIProviderError {
  if (err instanceof AIProviderError) return err;

  const status = extractStatus(err);
  const message = (err as { message?: string })?.message ?? '';

  if (status === 401 || status === 403 || /permission|api key|unauthenticated|unauthorized/i.test(message)) {
    return new AIProviderError('auth', 'Falha de autenticação/permissão no Gemini.', provider, false, err);
  }
  if (status === 429 || /quota|rate limit|resource[_ ]?exhausted/i.test(message)) {
    return new AIProviderError('rate_limit', 'Limite de requisições/quota do Gemini atingido.', provider, true, err);
  }
  if (isAbortError(err) || /timeout|timed out|deadline/i.test(message)) {
    return new AIProviderError('timeout', 'Timeout ao chamar o Gemini.', provider, true, err);
  }
  if ((status !== undefined && status >= 500) || /unavailable|internal|network|fetch failed/i.test(message)) {
    return new AIProviderError('unavailable', 'Serviço Gemini indisponível.', provider, true, err);
  }
  if (status !== undefined && status >= 400) {
    return new AIProviderError('invalid_response', `Erro da API Gemini (HTTP ${status}).`, provider, false, err);
  }
  return new AIProviderError('unavailable', 'Erro inesperado ao chamar o Gemini.', provider, true, err);
}

function extractStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const candidate = err as { status?: unknown; code?: unknown };
  if (typeof candidate.status === 'number') return candidate.status;
  if (typeof candidate.code === 'number') return candidate.code;
  const match = typeof (err as { message?: string }).message === 'string'
    ? (err as { message: string }).message.match(/\b(4\d\d|5\d\d)\b/)
    : null;
  return match ? Number(match[1]) : undefined;
}

function isAbortError(err: unknown): boolean {
  return Boolean(err) && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';
}
