import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
    needsReviewOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Identity not found",
      });
    }

    const orgId = identity.orgId as string;
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const paginated = await ctx.db
      .query("evaluations")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .paginate(args.paginationOpts);

    let filteredPage = paginated.page;

    if (args.status) {
      filteredPage = filteredPage.filter((e) => e.status === args.status);
    }

    if (args.needsReviewOnly) {
      filteredPage = filteredPage.filter(
        (e) => e.scores?.needsHumanReview || e.humanReviewStatus === "flagged"
      );
    }

    return {
      ...paginated,
      page: filteredPage,
    };
  },
});

export const getSummaryMetrics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Identity not found",
      });
    }

    const orgId = identity.orgId as string;
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const records = await ctx.db
      .query("evaluations")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .take(500);

    if (records.length === 0) {
      return {
        totalEvaluated: 0,
        averageFaithfulness: 0,
        averageAnswerRelevance: 0,
        averageContextRelevance: 0,
        averageCompleteness: 0,
        citationPassRate: 100,
        policyComplianceRate: 100,
        needsReviewCount: 0,
      };
    }

    let sumFaithfulness = 0;
    let sumAnswerRelevance = 0;
    let sumContextRelevance = 0;
    let sumCompleteness = 0;
    let citationPasses = 0;
    let policyPasses = 0;
    let scoredCount = 0;
    let needsReviewCount = 0;

    for (const record of records) {
      if (record.scores) {
        sumFaithfulness += record.scores.faithfulness.score;
        sumAnswerRelevance += record.scores.answerRelevance.score;
        sumContextRelevance += record.scores.contextRelevance.score;
        sumCompleteness += record.scores.completeness.score;
        if (record.scores.citationValidity.pass) citationPasses++;
        if (record.scores.policyCompliance.pass) policyPasses++;
        if (record.scores.needsHumanReview || record.humanReviewStatus === "flagged") {
          needsReviewCount++;
        }
        scoredCount++;
      }
    }

    return {
      totalEvaluated: records.length,
      averageFaithfulness: scoredCount > 0 ? Number((sumFaithfulness / scoredCount).toFixed(2)) : 0,
      averageAnswerRelevance: scoredCount > 0 ? Number((sumAnswerRelevance / scoredCount).toFixed(2)) : 0,
      averageContextRelevance: scoredCount > 0 ? Number((sumContextRelevance / scoredCount).toFixed(2)) : 0,
      averageCompleteness: scoredCount > 0 ? Number((sumCompleteness / scoredCount).toFixed(2)) : 0,
      citationPassRate: scoredCount > 0 ? Number(((citationPasses / scoredCount) * 100).toFixed(1)) : 100,
      policyComplianceRate: scoredCount > 0 ? Number(((policyPasses / scoredCount) * 100).toFixed(1)) : 100,
      needsReviewCount,
    };
  },
});

export const submitHumanReview = mutation({
  args: {
    evaluationId: v.id("evaluations"),
    status: v.union(v.literal("approved"), v.literal("flagged")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Identity not found",
      });
    }

    const orgId = identity.orgId as string;
    if (!orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const evaluation = await ctx.db.get(args.evaluationId);
    if (!evaluation || evaluation.organizationId !== orgId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Evaluation record not found",
      });
    }

    await ctx.db.patch(args.evaluationId, {
      humanReviewStatus: args.status,
      humanReviewNotes: args.notes,
      humanReviewedBy: identity.name || identity.email || "Operator",
      humanReviewedAt: Date.now(),
    });
  },
});
