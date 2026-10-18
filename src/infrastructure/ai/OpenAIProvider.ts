import OpenAI from 'openai';
import {
  AICompletionRequest,
  AIProvider,
  AIProviderError,
} from '../../domain/interfaces/IAIProvider';
import { AIConfig } from './aiConfig';
import { logAiEvent } from './aiLogger';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  constructor(
    private readonly client: Pick<OpenAI, 'chat'>,
    readonly model: string,
  ) {}

  static fromConfig(config: AIConfig): OpenAIProvider {
    if (!config.openai.apiKey) {
      throw new AIProviderError('config', 'OPENAI_API_KEY ausente.', 'openai');
    }
    const client = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: config.timeoutMs,
      maxRetries: config.maxRetries,
      baseURL: config.openai.baseURL || undefined,
    });
    return new OpenAIProvider(client, config.openai.model);
  }

  async generateJson(request: AICompletionRequest): Promise<unknown> {
    const startedAt = Date.now();
    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          temperature: request.temperature ?? 0.3,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: request.schemaName, schema: request.schema, strict: true },
          },
        },
        { signal: request.signal },
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new AIProviderError('invalid_response', 'Resposta vazia do OpenAI.', this.name);
      }

      const parsed = safeJsonParse(content, this.name);
      logAiEvent({
        provider: this.name,
        model: this.model,
        operation: request.schemaName,
        status: 'ok',
        latencyMs: Date.now() - startedAt,
        tokens: response.usage?.total_tokens,
      });
      return parsed;
    } catch (err) {
      const mapped = mapOpenAIError(err, this.name);
      logAiEvent({
        provider: this.name,
        model: this.model,
        operation: request.schemaName,
        status: 'error',
        latencyMs: Date.now() - startedAt,
        errorKind: mapped.kind,
      });
      throw mapped;
    }
  }
}

function safeJsonParse(content: string, provider: string): unknown {
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new AIProviderError('invalid_response', 'JSON inválido retornado pelo OpenAI.', provider, false, err);
  }
}

export function mapOpenAIError(err: unknown, provider: string): AIProviderError {
  if (err instanceof AIProviderError) return err;

  if (err instanceof OpenAI.AuthenticationError) {
    return new AIProviderError('auth', 'Falha de autenticação no OpenAI.', provider, false, err);
  }
  if (err instanceof OpenAI.PermissionDeniedError) {
    return new AIProviderError('auth', 'Acesso negado no OpenAI.', provider, false, err);
  }
  if (err instanceof OpenAI.RateLimitError) {
    return new AIProviderError('rate_limit', 'Limite de requisições/quota do OpenAI atingido.', provider, true, err);
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new AIProviderError('timeout', 'Timeout ao chamar o OpenAI.', provider, true, err);
  }
  if (err instanceof OpenAI.APIConnectionError) {
    return new AIProviderError('unavailable', 'Falha de conexão com o OpenAI.', provider, true, err);
  }
  if (err instanceof OpenAI.APIError) {
    const status = typeof err.status === 'number' ? err.status : undefined;
    const retryable = status !== undefined && status >= 500;
    return new AIProviderError(
      retryable ? 'unavailable' : 'invalid_response',
      `Erro da API OpenAI${status ? ` (HTTP ${status})` : ''}.`,
      provider,
      retryable,
      err,
    );
  }
  if (isAbortError(err)) {
    return new AIProviderError('timeout', 'Requisição ao OpenAI abortada por timeout.', provider, true, err);
  }
  return new AIProviderError('unavailable', 'Erro inesperado ao chamar o OpenAI.', provider, true, err);
}

function isAbortError(err: unknown): boolean {
  return Boolean(err) && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';
}
