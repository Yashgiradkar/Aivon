import assert from "node:assert/strict";
import {
  RateLimiterLogic,
  TIER_CONFIGURATIONS,
  SubscriptionTier,
} from "../../packages/backend/convex/system/ai/rateLimit/rateLimiter";

export async function runRateLimitingTests(): Promise<void> {
  console.log("Running Distributed Tiered Rate Limiter Tests...");

  const now = Date.now();

  // Test 1: Tier default configuration validation
  assert.equal(TIER_CONFIGURATIONS.free.requestsPerMinute, 20);
  assert.equal(TIER_CONFIGURATIONS.free.maxConcurrentOperations, 2);
  assert.equal(TIER_CONFIGURATIONS.free.monthlyTokenQuota, 100_000);

  assert.equal(TIER_CONFIGURATIONS.pro.requestsPerMinute, 120);
  assert.equal(TIER_CONFIGURATIONS.pro.maxConcurrentOperations, 10);
  assert.equal(TIER_CONFIGURATIONS.pro.monthlyTokenQuota, 2_500_000);

  assert.equal(TIER_CONFIGURATIONS.enterprise.requestsPerMinute, 600);
  assert.equal(TIER_CONFIGURATIONS.enterprise.maxConcurrentOperations, 50);
  assert.equal(TIER_CONFIGURATIONS.enterprise.monthlyTokenQuota, 25_000_000);

  // Test 2: Standard admission for Free tier under normal conditions
  const freeAdmission = RateLimiterLogic.evaluateAdmission(
    {
      tier: "free",
      tokensUsedThisMonth: 10_000,
      monthlyTokenQuota: 100_000,
      monthlyPeriodStart: now,
      requestsThisMinute: 5,
      minuteWindowStart: now,
      concurrentOperationsActive: 0,
      maxConcurrentOperations: 2,
    },
    { estimatedTokens: 500 }
  );

  assert.equal(freeAdmission.decision.allowed, true);
  assert.equal(freeAdmission.updatedUsage.requestsThisMinute, 6);
  assert.equal(freeAdmission.updatedUsage.tokensUsedThisMonth, 10_500);
  assert.equal(freeAdmission.updatedUsage.concurrentOperationsActive, 1);

  // Test 3: Concurrency limit rejection
  const concurrencyReject = RateLimiterLogic.evaluateAdmission(
    {
      tier: "free",
      tokensUsedThisMonth: 10_000,
      monthlyTokenQuota: 100_000,
      monthlyPeriodStart: now,
      requestsThisMinute: 5,
      minuteWindowStart: now,
      concurrentOperationsActive: 2, // At max limit (2)
      maxConcurrentOperations: 2,
    },
    { estimatedTokens: 500 }
  );

  assert.equal(concurrencyReject.decision.allowed, false);
  assert.equal(concurrencyReject.decision.reason, "CONCURRENCY_LIMIT");

  // Test 4: RPM burst rate exhaustion
  const rpmReject = RateLimiterLogic.evaluateAdmission(
    {
      tier: "free",
      tokensUsedThisMonth: 10_000,
      monthlyTokenQuota: 100_000,
      monthlyPeriodStart: now,
      requestsThisMinute: 20, // Reached 20 rpm limit
      minuteWindowStart: now,
      concurrentOperationsActive: 0,
      maxConcurrentOperations: 2,
    },
    { estimatedTokens: 500 }
  );

  assert.equal(rpmReject.decision.allowed, false);
  assert.equal(rpmReject.decision.reason, "RATE_LIMITED");

  // Test 5: RPM window rollover after 60 seconds
  const rpmReset = RateLimiterLogic.evaluateAdmission(
    {
      tier: "free",
      tokensUsedThisMonth: 10_000,
      monthlyTokenQuota: 100_000,
      monthlyPeriodStart: now - 70_000,
      requestsThisMinute: 20,
      minuteWindowStart: now - 65_000, // 65 seconds ago -> window expired
      concurrentOperationsActive: 0,
      maxConcurrentOperations: 2,
    },
    { estimatedTokens: 500 }
  );

  assert.equal(rpmReset.decision.allowed, true);
  assert.equal(rpmReset.updatedUsage.requestsThisMinute, 1); // Reset to 1

  // Test 6: Monthly token quota exhaustion
  const quotaReject = RateLimiterLogic.evaluateAdmission(
    {
      tier: "pro",
      tokensUsedThisMonth: 2_499_800,
      monthlyTokenQuota: 2_500_000,
      monthlyPeriodStart: now,
      requestsThisMinute: 10,
      minuteWindowStart: now,
      concurrentOperationsActive: 1,
      maxConcurrentOperations: 10,
    },
    { estimatedTokens: 500 } // Exceeds 2.5M
  );

  assert.equal(quotaReject.decision.allowed, false);
  assert.equal(quotaReject.decision.reason, "QUOTA_EXHAUSTED");

  // Test 7: Monthly period rollover after 30 days
  const thirtyOneDaysAgo = now - 31 * 24 * 60 * 60 * 1000;
  const quotaRollover = RateLimiterLogic.evaluateAdmission(
    {
      tier: "pro",
      tokensUsedThisMonth: 2_500_000, // Full last month
      monthlyTokenQuota: 2_500_000,
      monthlyPeriodStart: thirtyOneDaysAgo, // Rolled over
      requestsThisMinute: 10,
      minuteWindowStart: now,
      concurrentOperationsActive: 0,
      maxConcurrentOperations: 10,
    },
    { estimatedTokens: 500 }
  );

  assert.equal(quotaRollover.decision.allowed, true);
  assert.equal(quotaRollover.updatedUsage.tokensUsedThisMonth, 500); // Reset for new billing period

  // Test 8: Usage token reconciliation (adjusting reserved estimation vs actual consumed)
  const reconciled = RateLimiterLogic.reconcileUsage(
    {
      tokensUsedThisMonth: 10_500,
      concurrentOperationsActive: 2,
    },
    {
      estimatedTokensReserved: 500,
      actualTokensUsed: 320, // 180 fewer tokens actually used
    }
  );

  assert.equal(reconciled.tokensUsedThisMonth, 10_320);
  assert.equal(reconciled.concurrentOperationsActive, 1);

  // Test 9: Expensive operations rejection on Free tier
  const expensiveFree = RateLimiterLogic.evaluateAdmission(
    {
      tier: "free",
      tokensUsedThisMonth: 10_000,
      monthlyTokenQuota: 100_000,
      monthlyPeriodStart: now,
      requestsThisMinute: 2,
      minuteWindowStart: now,
      concurrentOperationsActive: 0,
      maxConcurrentOperations: 2,
    },
    { estimatedTokens: 500, isExpensiveOp: true }
  );

  assert.equal(expensiveFree.decision.allowed, false);
  assert.equal(expensiveFree.decision.reason, "TIER_RESTRICTION");

  console.log("✅ All Distributed Tiered Rate Limiter Tests Passed Successfully!");
}

runRateLimitingTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

