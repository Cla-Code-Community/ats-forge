import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { OpenAIProvider, mapOpenAIError } from '../src/infrastructure/ai/OpenAIProvider';

type CreateFn = () => Promise<unknown>;

function providerWith(create: CreateFn): OpenAIProvider {
  const client = { chat: { completions: { create } } } as unknown as Pick<OpenAI, 'chat'>;
  return new OpenAIProvider(client, 'gpt-test');
}

const request = { system: 's', user: 'u', schema: { type: 'object' }, schemaName: 'job_analysis' };
const headers = new Headers();

describe('OpenAIProvider', () => {
  it('faz parse do JSON retornado e envia structured output', async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: '{"role":"Dev"}' } }],
      usage: { total_tokens: 42 },
    }));
    const provider = providerWith(create);

    const result = await provider.generateJson(request);
    expect(result).toEqual({ role: 'Dev' });

    const args = create.mock.calls[0][0] as { response_format: { type: string; json_schema: { strict: boolean } } };
    expect(args.response_format.type).toBe('json_schema');
    expect(args.response_format.json_schema.strict).toBe(true);
  });

  it('mapeia resposta vazia para invalid_response', async () => {
    const provider = providerWith(async () => ({ choices: [{ message: { content: '' } }] }));
    await expect(provider.generateJson(request)).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('mapeia JSON malformado para invalid_response', async () => {
    const provider = providerWith(async () => ({ choices: [{ message: { content: '{not json' } }] }));
    await expect(provider.generateJson(request)).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('mapeia erros do SDK para kinds estáveis', () => {
    expect(mapOpenAIError(new OpenAI.AuthenticationError(401, {}, 'a', headers), 'openai').kind).toBe('auth');
    const rate = mapOpenAIError(new OpenAI.RateLimitError(429, {}, 'r', headers), 'openai');
    expect(rate.kind).toBe('rate_limit');
    expect(rate.retryable).toBe(true);
    expect(mapOpenAIError(new OpenAI.APIConnectionTimeoutError({ message: 't' }), 'openai').kind).toBe('timeout');
    expect(mapOpenAIError(new OpenAI.APIError(500, {}, 's', headers), 'openai').kind).toBe('unavailable');
    expect(mapOpenAIError(new Error('boom'), 'openai').kind).toBe('unavailable');
  });

  it('propaga erro de rate limit a partir do create', async () => {
    const provider = providerWith(async () => {
      throw new OpenAI.RateLimitError(429, {}, 'quota', headers);
    });
    await expect(provider.generateJson(request)).rejects.toMatchObject({ kind: 'rate_limit', retryable: true });
  });
});
