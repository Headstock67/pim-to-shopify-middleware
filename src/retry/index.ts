import { logger } from '../logging';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  useJitter?: boolean;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  contextName: string,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const useJitter = options.useJitter ?? true;

  let attempt = 1;

  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt >= maxAttempts || (error.isRetryable === false)) {
        logger.error({ err: error, contextName, attempt, maxAttempts }, `Retry exhausted or non-retryable error for ${contextName}`);
        throw error;
      }

      // Exponential backoff
      let delay = baseDelayMs * Math.pow(2, attempt - 1);
      
      if (useJitter) {
        // Full jitter strategy: random between 0 and delay bounds
        delay = Math.floor(Math.random() * delay);
      }

      logger.warn(
        { err: error, contextName, attempt, nextDelayInMs: delay },
        `Operation failed. Retrying ${contextName} in ${delay}ms...`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    }
  }
}
