/**
 * Distributed, Tiered Rate Limiting and Token Accounting Subsystem
 *
 * Enforces server-side quota controls for Free, Pro, and Enterprise tiers.
 * Concurrency-safe atomic admission decisions implemented within Convex mutations.
 */

export type SubscriptionTier = "free" | "pro" | "enterprise";

export interface TierConfig {
  name: SubscriptionTier;
  requestsPerMinute: number;
  maxConcurrentOperations: number;
  monthlyTokenQuota: number;
  allowedExpensiveOperations: boolean;
}

export const TIER_CONFIGURATIONS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: "free",
    requestsPerMinute: 20,
    maxConcurrentOperations: 2,
    monthlyTokenQuota: 100_000, // 100k tokens/month
    allowedExpensiveOperations: false,
  },
  pro: {
    name: "pro",
    requestsPerMinute: 120,
    maxConcurrentOperations: 10,
    monthlyTokenQuota: 2_500_000, // 2.5M tokens/month
    allowedExpensiveOperations: true,
  },
  enterprise: {
    name: "enterprise",
    requestsPerMinute: 600,
    maxConcurrentOperations: 50,
    monthlyTokenQuota: 25_000_000, // 25M tokens/month
    allowedExpensiveOperations: true,
  },
};

export interface AdmissionDecision {
  allowed: boolean;
  reason?: "RATE_LIMITED" | "CONCURRENCY_LIMIT" | "QUOTA_EXHAUSTED" | "TIER_RESTRICTION";
  retryAfterSeconds?: number;
  remainingTokensThisMonth?: number;
  requestsRemainingThisMinute?: number;
}

export class RateLimiterLogic {
  /**
   * Evaluates admission against tier limits and current usage counters.
   * Pure deterministic logic used by Convex mutations and automated unit tests.
   */
  public static evaluateAdmission(
    usage: {
      tier: SubscriptionTier;
      tokensUsedThisMonth: number;
      monthlyTokenQuota: number;
      monthlyPeriodStart: number;
      requestsThisMinute: number;
      minuteWindowStart: number;
      concurrentOperationsActive: number;
    },
    options?: {
      isExpensiveOp?: boolean;
      estimatedTokens?: number;
      now?: number;
    }
  ): {
    decision: AdmissionDecision;
    updatedUsage: {
      tokensUsedThisMonth: number;
      requestsThisMinute: number;
      minuteWindowStart: number;
      concurrentOperationsActive: number;
      monthlyPeriodStart: number;
    };
  } {
    const now = options?.now ?? Date.now();
    const config = TIER_CONFIGURATIONS[usage.tier] || TIER_CONFIGURATIONS.free;
    const estTokens = options?.estimatedTokens ?? 100;

    // 1. Check expensive operation entitlement
    if (options?.isExpensiveOp && !config.allowedExpensiveOperations) {
      return {
        decision: {
          allowed: false,
          reason: "TIER_RESTRICTION",
        },
        updatedUsage: {
          tokensUsedThisMonth: usage.tokensUsedThisMonth,
          requestsThisMinute: usage.requestsThisMinute,
          minuteWindowStart: usage.minuteWindowStart,
          concurrentOperationsActive: usage.concurrentOperationsActive,
          monthlyPeriodStart: usage.monthlyPeriodStart,
        },
      };
    }

    // 2. Check 30-day monthly quota rollover
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    let tokensUsed = usage.tokensUsedThisMonth;
    let monthlyStart = usage.monthlyPeriodStart;
    if (now - monthlyStart >= thirtyDaysMs) {
      tokensUsed = 0;
      monthlyStart = now;
    }

    // Check token quota
    if (tokensUsed + estTokens > config.monthlyTokenQuota) {
      return {
        decision: {
          allowed: false,
          reason: "QUOTA_EXHAUSTED",
          remainingTokensThisMonth: Math.max(0, config.monthlyTokenQuota - tokensUsed),
        },
        updatedUsage: {
          tokensUsedThisMonth: tokensUsed,
          requestsThisMinute: usage.requestsThisMinute,
          minuteWindowStart: usage.minuteWindowStart,
          concurrentOperationsActive: usage.concurrentOperationsActive,
          monthlyPeriodStart: monthlyStart,
        },
      };
    }

    // 3. Concurrency check
    if (usage.concurrentOperationsActive >= config.maxConcurrentOperations) {
      return {
        decision: {
          allowed: false,
          reason: "CONCURRENCY_LIMIT",
          retryAfterSeconds: 2,
        },
        updatedUsage: {
          tokensUsedThisMonth: tokensUsed,
          requestsThisMinute: usage.requestsThisMinute,
          minuteWindowStart: usage.minuteWindowStart,
          concurrentOperationsActive: usage.concurrentOperationsActive,
          monthlyPeriodStart: monthlyStart,
        },
      };
    }

    // 4. Minute window burst check
    let minuteStart = usage.minuteWindowStart;
    let reqsThisMinute = usage.requestsThisMinute;
    if (now - minuteStart >= 60_000) {
      minuteStart = now;
      reqsThisMinute = 0;
    }

    if (reqsThisMinute >= config.requestsPerMinute) {
      const waitSeconds = Math.max(1, Math.ceil((60_000 - (now - minuteStart)) / 1000));
      return {
        decision: {
          allowed: false,
          reason: "RATE_LIMITED",
          retryAfterSeconds: waitSeconds,
          requestsRemainingThisMinute: 0,
        },
        updatedUsage: {
          tokensUsedThisMonth: tokensUsed,
          requestsThisMinute: reqsThisMinute,
          minuteWindowStart: minuteStart,
          concurrentOperationsActive: usage.concurrentOperationsActive,
          monthlyPeriodStart: monthlyStart,
        },
      };
    }

    // All checks pass: increment active counters
    return {
      decision: {
        allowed: true,
        remainingTokensThisMonth: config.monthlyTokenQuota - (tokensUsed + estTokens),
        requestsRemainingThisMinute: config.requestsPerMinute - (reqsThisMinute + 1),
      },
      updatedUsage: {
        tokensUsedThisMonth: tokensUsed + estTokens,
        requestsThisMinute: reqsThisMinute + 1,
        minuteWindowStart: minuteStart,
        concurrentOperationsActive: usage.concurrentOperationsActive + 1,
        monthlyPeriodStart: monthlyStart,
      },
    };
  }

  /**
   * Reconciles estimated vs actual token usage after model completion,
   * decrementing active concurrency counter.
   */
  public static reconcileUsage(
    currentTokensUsedOrObj: number | { tokensUsedThisMonth: number; concurrentOperationsActive: number },
    estimatedTokensReservedOrOpts?: number | { estimatedTokensReserved: number; actualTokensUsed: number },
    actualTokensUsed?: number,
    currentConcurrency?: number
  ): {
    tokensUsedThisMonth: number;
    concurrentOperationsActive: number;
  } {
    let currentTokens: number;
    let estimatedReserved: number;
    let actual: number;
    let concurrency: number;

    if (typeof currentTokensUsedOrObj === "object") {
      currentTokens = currentTokensUsedOrObj.tokensUsedThisMonth;
      concurrency = currentTokensUsedOrObj.concurrentOperationsActive;
      const opts = estimatedTokensReservedOrOpts as { estimatedTokensReserved: number; actualTokensUsed: number };
      estimatedReserved = opts.estimatedTokensReserved;
      actual = opts.actualTokensUsed;
    } else {
      currentTokens = currentTokensUsedOrObj;
      estimatedReserved = estimatedTokensReservedOrOpts as number;
      actual = actualTokensUsed!;
      concurrency = currentConcurrency!;
    }

    const diff = actual - estimatedReserved;
    return {
      tokensUsedThisMonth: Math.max(0, currentTokens + diff),
      concurrentOperationsActive: Math.max(0, concurrency - 1),
    };
  }
}
