/**
 * Exponential Backoff Retry Policy with Jitter & Error Classification
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

export type LLMErrorCode =
  | "LLM_TIMEOUT"
  | "LLM_RATE_LIMIT"
  | "LLM_PROVIDER_ERROR"
  | "LLM_AUTH_ERROR"
  | "LLM_INVALID_RESPONSE"
  | "RAG_FAILURE"
  | "TOOL_FAILURE"
  | "VALIDATION_ERROR";

export class LLMError extends Error {
  constructor(
    public readonly code: LLMErrorCode,
    message: string,
    public readonly originalError?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export function classifyError(err: unknown): LLMError {
  if (err instanceof LLMError) return err;

  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("abort")) {
    return new LLMError("LLM_TIMEOUT", `Operation timed out: ${msg}`, err, true);
  }

  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("quota")) {
    return new LLMError("LLM_RATE_LIMIT", `Rate limit encountered: ${msg}`, err, true);
  }

  if (lower.includes("unauthorized") || lower.includes("401") || lower.includes("invalid api key")) {
    return new LLMError("LLM_AUTH_ERROR", `Authentication failure: ${msg}`, err, false);
  }

  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("server error")) {
    return new LLMError("LLM_PROVIDER_ERROR", `Provider server error: ${msg}`, err, true);
  }

  return new LLMError("LLM_INVALID_RESPONSE", `Unhandled LLM error: ${msg}`, err, false);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const initialDelayMs = options.initialDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const backoffFactor = options.backoffFactor ?? 2;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      const classified = classifyError(error);
      attempt++;

      if (attempt > maxRetries || !classified.retryable) {
        throw classified;
      }

      // Add jitter: randomize between 0.8x and 1.2x of current delay
      const jitter = delay * (0.8 + Math.random() * 0.4);
      const sleepTime = Math.min(jitter, maxDelayMs);

      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      delay *= backoffFactor;
    }
  }
}
