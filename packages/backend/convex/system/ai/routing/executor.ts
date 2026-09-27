import { withRetry, classifyError } from "./retry";
import { globalCircuitBreaker } from "./circuitBreaker";

export interface ExecutionOptions {
  timeoutMs?: number;
  maxRetries?: number;
  fallback?: () => Promise<string>;
}

/**
 * Executes an async task with timeout bounds, exponential backoff retries, and circuit breaker protection.
 */
export async function executeReliableAI<T>(
  task: () => Promise<T>,
  options: ExecutionOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15000;

  const withTimeout = async (): Promise<T> => {
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`AI execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([task(), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  return globalCircuitBreaker.execute(
    () => withRetry(withTimeout, { maxRetries: options.maxRetries ?? 2 }),
    options.fallback ? (options.fallback as () => Promise<T>) : undefined
  );
}
