import { AIProviderError } from '../../domain/interfaces/IAIProvider';

export async function withRetries<T>(
  fn: (attempt: number) => Promise<T>,
  options: { maxRetries: number; baseDelayMs?: number; onRetry?: (attempt: number) => void },
): Promise<T> {
  const { maxRetries, baseDelayMs = 400, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const retryable = err instanceof AIProviderError && err.retryable;
      if (!retryable || attempt > maxRetries) break;
      onRetry?.(attempt);
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * baseDelayMs);
      await delay(backoff + jitter);
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
