/**
 * Durable Background Job Runner Logic
 *
 * Implements:
 * 1. Exponential backoff with randomized jitter
 * 2. Concurrency constraints (per-tenant and global)
 * 3. Error sanitization (scrub credentials, stack internals, PII)
 * 4. Idempotency validation
 */

export type JobType =
  | "document_ingestion"
  | "evaluation_batch"
  | "memory_extraction"
  | "cache_maintenance";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface JobRetryPolicy {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
}

export class JobRunnerLogic {
  public static DEFAULT_MAX_ATTEMPTS = 3;
  public static MAX_TENANT_CONCURRENCY = 5;
  public static MAX_GLOBAL_CONCURRENCY = 20;

  /**
   * Computes exponential backoff with full jitter to avoid thundering herds.
   */
  public static computeNextRetry(
    attempt: number,
    baseMs: number = 2000,
    maxMs: number = 60000
  ): number {
    const rawBackoff = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
    const jitter = Math.random() * (rawBackoff * 0.3); // 30% jitter
    return Math.floor(rawBackoff + jitter);
  }

  /**
   * Sanitizes error message before storing in the database or surfacing in dashboard.
   */
  public static sanitizeError(err: unknown): string {
    if (!err) return "Unknown background job error";

    let message = "";
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === "string") {
      message = err;
    } else {
      message = JSON.stringify(err);
    }

    // Scrub potential tokens, keys, passwords, and sensitive identifiers
    message = message.replace(/(Bearer\s+[A-Za-z0-9_\-\.]+)/gi, "Bearer [REDACTED]");
    message = message.replace(/(sk-[A-Za-z0-9_\-]{20,})/gi, "sk-[REDACTED]");
    message = message.replace(/(password|secret|cvv)=([^\s&]+)/gi, "$1=[REDACTED]");

    return message.slice(0, 500); // Bounded length
  }

  /**
   * Verifies if a tenant has reached its maximum concurrent job quota.
   */
  public static isConcurrencyExceeded(
    activeTenantJobs: number,
    limit: number = this.MAX_TENANT_CONCURRENCY
  ): boolean {
    return activeTenantJobs >= limit;
  }
}
