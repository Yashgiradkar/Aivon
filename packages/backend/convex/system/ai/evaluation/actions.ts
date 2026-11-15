import { v } from "convex/values";
import { internalAction, internalMutation } from "../../../_generated/server";
import { internal } from "../../../_generated/api";
import { evaluateWithJudge, RUBRIC_VERSION } from "./judge";
import { estimateCostUsd } from "../observability/costCalculator";
import { estimateTokens } from "../context/tokenEstimator";

export const recordEvaluation = internalMutation({
  args: {
    organizationId: v.string(),
    conversationId: v.id("conversations"),
    threadId: v.string(),
    traceId: v.optional(v.string()),
    userQuestion: v.string(),
    agentAnswer: v.string(),
    retrievedEvidence: v.optional(v.string()),
    evidenceIds: v.optional(v.array(v.string())),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    judgeModel: v.string(),
    rubricVersion: v.string(),
    scores: v.optional(
      v.object({
        faithfulness: v.object({ score: v.number(), rationale: v.string() }),
        answerRelevance: v.object({ score: v.number(), rationale: v.string() }),
        contextRelevance: v.object({ score: v.number(), rationale: v.string() }),
        completeness: v.object({ score: v.number(), rationale: v.string() }),
        citationValidity: v.object({ pass: v.boolean(), rationale: v.string() }),
        policyCompliance: v.object({ pass: v.boolean(), rationale: v.string() }),
        toolUseCorrectness: v.optional(v.object({ score: v.number(), rationale: v.string() })),
        overallScore: v.number(),
        needsHumanReview: v.boolean(),
      })
    ),
    humanReviewStatus: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("flagged"))
    ),
    latencyMs: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("evaluations", args);
  },
});

export const evaluateInteraction = internalAction({
  args: {
    organizationId: v.string(),
    conversationId: v.id("conversations"),
    threadId: v.string(),
    traceId: v.optional(v.string()),
    userQuestion: v.string(),
    agentAnswer: v.string(),
    retrievedEvidence: v.optional(v.string()),
    toolsUsed: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const judgeModel = "gpt-4o-mini";

    try {
      const evaluation = await evaluateWithJudge({
        userQuestion: args.userQuestion,
        agentAnswer: args.agentAnswer,
        retrievedEvidence: args.retrievedEvidence,
        toolsUsed: args.toolsUsed,
        judgeModel,
      });

      const latencyMs = Date.now() - startTime;
      const inputTokens =
        estimateTokens(args.userQuestion) +
        estimateTokens(args.agentAnswer) +
        estimateTokens(args.retrievedEvidence || "") +
        400; // system prompt tokens
      const outputTokens = 250;
      const costUsd = estimateCostUsd(judgeModel, inputTokens, outputTokens);

      await ctx.runMutation(internal.system.ai.evaluation.actions.recordEvaluation, {
        organizationId: args.organizationId,
        conversationId: args.conversationId,
        threadId: args.threadId,
        traceId: args.traceId,
        userQuestion: args.userQuestion,
        agentAnswer: args.agentAnswer,
        retrievedEvidence: args.retrievedEvidence,
        status: "completed",
        judgeModel,
        rubricVersion: RUBRIC_VERSION,
        scores: evaluation,
        humanReviewStatus: evaluation.needsHumanReview ? "pending" : "approved",
        latencyMs,
        costUsd,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error("[Evaluation Action] Failed to execute judge evaluation:", err);
      await ctx.runMutation(internal.system.ai.evaluation.actions.recordEvaluation, {
        organizationId: args.organizationId,
        conversationId: args.conversationId,
        threadId: args.threadId,
        traceId: args.traceId,
        userQuestion: args.userQuestion,
        agentAnswer: args.agentAnswer,
        retrievedEvidence: args.retrievedEvidence,
        status: "failed",
        judgeModel,
        rubricVersion: RUBRIC_VERSION,
        humanReviewStatus: "flagged",
        latencyMs: Date.now() - startTime,
        createdAt: Date.now(),
      });
    }
  },
});
