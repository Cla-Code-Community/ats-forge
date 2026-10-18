import { describe, expect, it, vi } from 'vitest';
import { AIProviderError } from '../src/domain/interfaces/IAIProvider';
import { loadAIConfig } from '../src/infrastructure/ai/aiConfig';
import { AIProviderFactory, FallbackAIProvider } from '../src/infrastructure/ai/AIProviderFactory';
import { FakeAIProvider } from './aiFixtures';

describe('AIProviderFactory', () => {
  it('retorna null quando a IA está desabilitada', () => {
    expect(AIProviderFactory.create(loadAIConfig({}))).toBeNull();
  });

  it('constrói OpenAIProvider quando configurado', () => {
    const provider = AIProviderFactory.create(loadAIConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk' }));
    expect(provider?.name).toBe('openai');
  });

  it('constrói GeminiProvider quando configurado', () => {
    const provider = AIProviderFactory.create(loadAIConfig({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g' }));
    expect(provider?.name).toBe('gemini');
  });

  it('envolve em FallbackAIProvider só quando o fallback tem chave', () => {
    const withFallback = AIProviderFactory.create(
      loadAIConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk', AI_FALLBACK_PROVIDER: 'gemini', GEMINI_API_KEY: 'g' }),
    );
    expect(withFallback?.name).toBe('openai->gemini');

    const noKey = AIProviderFactory.create(
      loadAIConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk', AI_FALLBACK_PROVIDER: 'gemini' }),
    );
    expect(noKey?.name).toBe('openai');
  });
});

describe('FallbackAIProvider', () => {
  const request = { system: 's', user: 'u', schema: {}, schemaName: 'x' };

  it('usa o fallback em erro retryable do principal', async () => {
    const primary = new FakeAIProvider([], () => new AIProviderError('rate_limit', 'quota', 'openai', true), 'openai');
    const fallback = new FakeAIProvider([{ ok: true }], undefined, 'gemini');
    const wrapper = new FallbackAIProvider(primary, fallback);

    await expect(wrapper.generateJson(request)).resolves.toEqual({ ok: true });
    expect(fallback.requests).toHaveLength(1);
  });

  it('não mascara erro NÃO-retryable (auth)', async () => {
    const primary = new FakeAIProvider([], () => new AIProviderError('auth', 'bad key', 'openai', false), 'openai');
    const fallback = new FakeAIProvider([{ ok: true }], undefined, 'gemini');
    const spy = vi.spyOn(fallback, 'generateJson');
    const wrapper = new FallbackAIProvider(primary, fallback);

    await expect(wrapper.generateJson(request)).rejects.toMatchObject({ kind: 'auth' });
    expect(spy).not.toHaveBeenCalled();
  });
});
