import { ResumeAIService } from '../../application/ai/ResumeAIService';
import { AIConfig, isMisconfigured, loadAIConfig } from './aiConfig';
import { AIProviderFactory } from './AIProviderFactory';
import { logAiEvent } from './aiLogger';

let warnedOnce = false;

export function createResumeAIService(env: NodeJS.ProcessEnv = process.env): ResumeAIService | null {
  const config = loadAIConfig(env);
  return buildResumeAIService(config);
}

export function buildResumeAIService(config: AIConfig): ResumeAIService | null {
  if (isMisconfigured(config) && !warnedOnce) {
    warnedOnce = true;
    logAiEvent({
      provider: config.provider,
      model: '-',
      operation: 'init',
      status: 'error',
      errorKind: 'config:missing_api_key',
    });
  }

  const provider = AIProviderFactory.create(config);
  if (!provider) return null;

  logAiEvent({ provider: provider.name, model: provider.model, operation: 'init', status: 'ok' });
  return new ResumeAIService(provider, {
    maxInputChars: config.maxInputChars,
    temperature: config.temperature,
    deadlineMs: config.timeoutMs + 2000,
  });
}
