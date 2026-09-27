/**
 * In-Memory Sliding Window Rate Limiter
 *
 * Provides protection against abuse, denial-of-service, and runaway token loops per session/organization.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const sessionStore = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically to avoid memory growth
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStale(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of sessionStore.entries()) {
    const valid = record.timestamps.filter((ts) => now - ts < windowMs);
    if (valid.length === 0) {
      sessionStore.delete(key);
    } else {
      record.timestamps = valid;
    }
  }
}

export interface RateLimitResult {
  isAllowed: boolean;
  currentCount: number;
  maxLimit: number;
  resetTimeMs: number;
}

/**
 * Checks and updates sliding window rate limit for an identifier (e.g. contactSessionId).
 * Default: 20 messages per minute.
 */
export function checkRateLimit(
  identifier: string,
  maxLimit: number = 20,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const now = Date.now();
  cleanupStale(windowMs);

  let record = sessionStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    sessionStore.set(identifier, record);
  }

  // Filter timestamps within current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= maxLimit) {
    const oldest = record.timestamps[0] ?? now;
    return {
      isAllowed: false,
      currentCount: record.timestamps.length,
      maxLimit,
      resetTimeMs: oldest + windowMs - now,
    };
  }

  record.timestamps.push(now);

  return {
    isAllowed: true,
    currentCount: record.timestamps.length,
    maxLimit,
    resetTimeMs: 0,
  };
}
