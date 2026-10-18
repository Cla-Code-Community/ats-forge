import { describe, expect, it } from 'vitest';
import { AI_DEFAULTS, isMisconfigured, loadAIConfig } from '../src/infrastructure/ai/aiConfig';

describe('loadAIConfig', () => {
  it('fica desabilitado por padrão (sem env)', () => {
    const cfg = loadAIConfig({});
    expect(cfg.provider).toBe('none');
    expect(cfg.enabled).toBe(false);
    expect(cfg.openai.model).toBe(AI_DEFAULTS.OPENAI_MODEL);
    expect(cfg.gemini.model).toBe(AI_DEFAULTS.GEMINI_MODEL);
    expect(cfg.timeoutMs).toBe(AI_DEFAULTS.TIMEOUT_MS);
    expect(cfg.maxRetries).toBe(AI_DEFAULTS.MAX_RETRIES);
  });

  it('habilita OpenAI quando provider + chave presentes', () => {
    const cfg = loadAIConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'gpt-x' });
    expect(cfg.provider).toBe('openai');
    expect(cfg.enabled).toBe(true);
    expect(cfg.openai.model).toBe('gpt-x');
  });

  it('não habilita quando provider está setado mas a chave falta (misconfig)', () => {
    const cfg = loadAIConfig({ AI_PROVIDER: 'gemini' });
    expect(cfg.enabled).toBe(false);
    expect(isMisconfigured(cfg)).toBe(true);
  });

  it('habilita Gemini com a própria chave', () => {
    const cfg = loadAIConfig({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'g-test' });
    expect(cfg.provider).toBe('gemini');
    expect(cfg.enabled).toBe(true);
    expect(isMisconfigured(cfg)).toBe(false);
  });

  it('ignora provider desconhecido (cai para none)', () => {
    const cfg = loadAIConfig({ AI_PROVIDER: 'anthropic', OPENAI_API_KEY: 'x' });
    expect(cfg.provider).toBe('none');
    expect(cfg.enabled).toBe(false);
  });

  it('não configura fallback igual ao principal nem desconhecido', () => {
    const same = loadAIConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'x', AI_FALLBACK_PROVIDER: 'openai' });
    expect(same.fallbackProvider).toBeNull();
    const unknown = loadAIConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'x', AI_FALLBACK_PROVIDER: 'foo' });
    expect(unknown.fallbackProvider).toBeNull();
    const ok = loadAIConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'x', AI_FALLBACK_PROVIDER: 'gemini' });
    expect(ok.fallbackProvider).toBe('gemini');
  });

  it('usa defaults em números inválidos e respeita limites', () => {
    const cfg = loadAIConfig({ AI_TIMEOUT_MS: 'abc', AI_MAX_RETRIES: '-3', AI_TEMPERATURE: '9' });
    expect(cfg.timeoutMs).toBe(AI_DEFAULTS.TIMEOUT_MS);
    expect(cfg.maxRetries).toBe(AI_DEFAULTS.MAX_RETRIES);
    expect(cfg.temperature).toBe(AI_DEFAULTS.TEMPERATURE);
  });

  it('aceita números válidos dentro dos limites', () => {
    const cfg = loadAIConfig({ AI_TIMEOUT_MS: '5000', AI_MAX_RETRIES: '4', AI_TEMPERATURE: '0.7' });
    expect(cfg.timeoutMs).toBe(5000);
    expect(cfg.maxRetries).toBe(4);
    expect(cfg.temperature).toBe(0.7);
  });
});
