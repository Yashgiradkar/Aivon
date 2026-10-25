import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { RateLimiterLogic, SubscriptionTier, TIER_CONFIGURATIONS } from "./ai/rateLimit/rateLimiter";

export const checkAndAdmit = internalMutation({
  args: {
    organizationId: v.string(),
    estimatedTokens: v.optional(v.number()),
    isExpensiveOp: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let record = await ctx.db
      .query("tenantRateLimits")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (!record) {
      // Determine tier from subscriptions table or default to free
      const sub = await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", args.organizationId))
        .first();

      const tier: SubscriptionTier =
        sub?.status === "active"
          ? args.organizationId.toLowerCase().includes("enterprise")
            ? "enterprise"
            : "pro"
          : "free";

      const config = TIER_CONFIGURATIONS[tier];

      const recordId = await ctx.db.insert("tenantRateLimits", {
        organizationId: args.organizationId,
        tier,
        tokensUsedThisMonth: 0,
        monthlyTokenQuota: config.monthlyTokenQuota,
        monthlyPeriodStart: now,
        requestsThisMinute: 0,
        minuteWindowStart: now,
        concurrentOperationsActive: 0,
        maxConcurrentOperations: config.maxConcurrentOperations,
        lastActiveAt: now,
      });

      record = await ctx.db.get(recordId);
    }

    if (!record) {
      return { allowed: true };
    }

    const { decision, updatedUsage } = RateLimiterLogic.evaluateAdmission(
      {
        tier: record.tier as SubscriptionTier,
        tokensUsedThisMonth: record.tokensUsedThisMonth,
        monthlyTokenQuota: record.monthlyTokenQuota,
        monthlyPeriodStart: record.monthlyPeriodStart,
        requestsThisMinute: record.requestsThisMinute,
        minuteWindowStart: record.minuteWindowStart,
        concurrentOperationsActive: record.concurrentOperationsActive,
      },
      {
        isExpensiveOp: args.isExpensiveOp,
        estimatedTokens: args.estimatedTokens,
        now,
      }
    );

    if (decision.allowed) {
      await ctx.db.patch(record._id, {
        tokensUsedThisMonth: updatedUsage.tokensUsedThisMonth,
        requestsThisMinute: updatedUsage.requestsThisMinute,
        minuteWindowStart: updatedUsage.minuteWindowStart,
        concurrentOperationsActive: updatedUsage.concurrentOperationsActive,
        monthlyPeriodStart: updatedUsage.monthlyPeriodStart,
        lastActiveAt: now,
      });
    }

    return decision;
  },
});

export const reconcileTokens = internalMutation({
  args: {
    organizationId: v.string(),
    estimatedTokensReserved: v.number(),
    actualTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("tenantRateLimits")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (!record) return;

    const reconciled = RateLimiterLogic.reconcileUsage(
      record.tokensUsedThisMonth,
      args.estimatedTokensReserved,
      args.actualTokensUsed,
      record.concurrentOperationsActive
    );

    await ctx.db.patch(record._id, {
      tokensUsedThisMonth: reconciled.tokensUsedThisMonth,
      concurrentOperationsActive: reconciled.concurrentOperationsActive,
      lastActiveAt: Date.now(),
    });
  },
});

export const getUsageStats = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("tenantRateLimits")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (!record) {
      return {
        tier: "free",
        tokensUsedThisMonth: 0,
        monthlyTokenQuota: TIER_CONFIGURATIONS.free.monthlyTokenQuota,
        percentUsed: 0,
      };
    }

    const percentUsed = Number(
      ((record.tokensUsedThisMonth / record.monthlyTokenQuota) * 100).toFixed(2)
    );

    return {
      tier: record.tier,
      tokensUsedThisMonth: record.tokensUsedThisMonth,
      monthlyTokenQuota: record.monthlyTokenQuota,
      percentUsed,
      concurrentOperationsActive: record.concurrentOperationsActive,
      requestsThisMinute: record.requestsThisMinute,
    };
  },
});
