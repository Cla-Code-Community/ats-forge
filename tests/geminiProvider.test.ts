import { describe, expect, it, vi } from 'vitest';
import { GeminiProvider, mapGeminiError } from '../src/infrastructure/ai/GeminiProvider';

type GenFn = (...args: unknown[]) => Promise<unknown>;

function providerWith(generateContent: GenFn, maxRetries = 0): GeminiProvider {
  return new GeminiProvider({ generateContent } as never, 'gemini-test', maxRetries);
}

const request = { system: 's', user: 'u', schema: { type: 'object' }, schemaName: 'job_analysis' };

describe('GeminiProvider', () => {
  it('faz parse do texto JSON e passa responseJsonSchema', async () => {
    const generateContent = vi.fn(async () => ({
      text: '{"role":"Dev"}',
      usageMetadata: { totalTokenCount: 10 },
    }));
    const provider = providerWith(generateContent);

    const result = await provider.generateJson(request);
    expect(result).toEqual({ role: 'Dev' });

    const args = generateContent.mock.calls[0][0] as { config: { responseMimeType: string; responseJsonSchema: unknown; systemInstruction: string } };
    expect(args.config.responseMimeType).toBe('application/json');
    expect(args.config.responseJsonSchema).toEqual(request.schema);
    expect(args.config.systemInstruction).toBe('s');
  });

  it('mapeia resposta vazia para invalid_response', async () => {
    const provider = providerWith(async () => ({ text: undefined }));
    await expect(provider.generateJson(request)).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('repete em erro retryable e depois tem sucesso', async () => {
    let calls = 0;
    const generateContent = vi.fn(async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error('resource_exhausted 429'), { status: 429 });
      return { text: '{"ok":true}' };
    });
    const provider = providerWith(generateContent, 2);

    const result = await provider.generateJson(request);
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('não repete erro de autenticação', async () => {
    const generateContent = vi.fn(async () => {
      throw Object.assign(new Error('API key invalid'), { status: 403 });
    });
    const provider = providerWith(generateContent, 2);
    await expect(provider.generateJson(request)).rejects.toMatchObject({ kind: 'auth' });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('mapeia erros por status/mensagem', () => {
    expect(mapGeminiError({ status: 401 }, 'gemini').kind).toBe('auth');
    expect(mapGeminiError({ status: 429 }, 'gemini').kind).toBe('rate_limit');
    expect(mapGeminiError(Object.assign(new Error('x'), { name: 'AbortError' }), 'gemini').kind).toBe('timeout');
    expect(mapGeminiError({ status: 503 }, 'gemini').kind).toBe('unavailable');
    expect(mapGeminiError(new Error('unexpected'), 'gemini').kind).toBe('unavailable');
  });
});
