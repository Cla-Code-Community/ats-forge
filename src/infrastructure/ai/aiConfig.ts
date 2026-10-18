export type AIProviderName = 'openai' | 'gemini';

export interface AIProviderSettings {
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface AIConfig {
  provider: AIProviderName | 'none';
  enabled: boolean;
  openai: AIProviderSettings;
  gemini: AIProviderSettings;
  fallbackProvider: AIProviderName | null;
  timeoutMs: number;
  maxRetries: number;
  maxInputChars: number;
  temperature: number;
}

export const AI_DEFAULTS = {
  OPENAI_MODEL: 'gpt-4o-mini',
  GEMINI_MODEL: 'gemini-2.5-flash',
  TIMEOUT_MS: 30000,
  MAX_RETRIES: 2,
  MAX_INPUT_CHARS: 12000,
  TEMPERATURE: 0.3,
} as const;

type Env = Record<string, string | undefined>;

function str(env: Env, key: string, fallback = ''): string {
  return env[key]?.trim() || fallback;
}

function num(env: Env, key: string, fallback: number, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function parseProvider(raw: string | undefined): AIProviderName | 'none' {
  const value = raw?.trim().toLowerCase();
  if (value === 'openai' || value === 'gemini') return value;
  return 'none';
}

function parseFallback(raw: string | undefined, primary: AIProviderName | 'none'): AIProviderName | null {
  const value = parseProvider(raw);
  if (value === 'none' || value === primary) return null;
  return value;
}

export function loadAIConfig(env: Env = process.env): AIConfig {
  const provider = parseProvider(env.AI_PROVIDER);

  const openai: AIProviderSettings = {
    apiKey: str(env, 'OPENAI_API_KEY'),
    model: str(env, 'OPENAI_MODEL', AI_DEFAULTS.OPENAI_MODEL),
    baseURL: str(env, 'OPENAI_BASE_URL') || undefined,
  };
  const gemini: AIProviderSettings = {
    apiKey: str(env, 'GEMINI_API_KEY'),
    model: str(env, 'GEMINI_MODEL', AI_DEFAULTS.GEMINI_MODEL),
  };

  const hasKey = provider === 'openai' ? Boolean(openai.apiKey) : provider === 'gemini' ? Boolean(gemini.apiKey) : false;

  return {
    provider,
    enabled: provider !== 'none' && hasKey,
    openai,
    gemini,
    fallbackProvider: parseFallback(env.AI_FALLBACK_PROVIDER, provider),
    timeoutMs: num(env, 'AI_TIMEOUT_MS', AI_DEFAULTS.TIMEOUT_MS, { min: 1000, max: 600000 }),
    maxRetries: num(env, 'AI_MAX_RETRIES', AI_DEFAULTS.MAX_RETRIES, { min: 0, max: 10 }),
    maxInputChars: num(env, 'AI_MAX_INPUT_CHARS', AI_DEFAULTS.MAX_INPUT_CHARS, { min: 500, max: 200000 }),
    temperature: num(env, 'AI_TEMPERATURE', AI_DEFAULTS.TEMPERATURE, { min: 0, max: 2 }),
  };
}

export function isMisconfigured(config: AIConfig): boolean {
  return config.provider !== 'none' && !config.enabled;
}
