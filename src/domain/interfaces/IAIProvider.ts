export type JsonSchema = Record<string, unknown>;

export interface AICompletionRequest {
  system: string;
  user: string;
  schema: JsonSchema;
  schemaName: string;
  temperature?: number;
  signal?: AbortSignal;
}

export type AIErrorKind =
  | 'config'
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'unavailable'
  | 'invalid_response';

export class AIProviderError extends Error {
  constructor(
    public readonly kind: AIErrorKind,
    message: string,
    public readonly provider: string,
    public readonly retryable: boolean = false,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateJson(request: AICompletionRequest): Promise<unknown>;
}
