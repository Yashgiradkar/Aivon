import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const recordExecutionStart = internalMutation({
  args: {
    organizationId: v.string(),
    conversationId: v.id("conversations"),
    threadId: v.string(),
    triggerMessage: v.string(),
    idempotencyKey: v.string(),
    channel: v.union(v.literal("chat"), v.literal("voice"), v.literal("operator")),
    routingCategory: v.string(),
    executionPlan: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if an existing execution exists for this idempotency key
    const existing = await ctx.db
      .query("orchestrationExecutions")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();

    if (existing && existing.organizationId === args.organizationId) {
      return existing;
    }

    const now = Date.now();
    const executionId = await ctx.db.insert("orchestrationExecutions", {
      organizationId: args.organizationId,
      conversationId: args.conversationId,
      threadId: args.threadId,
      triggerMessage: args.triggerMessage,
      idempotencyKey: args.idempotencyKey,
      channel: args.channel,
      status: "running",
      routingCategory: args.routingCategory,
      executionPlan: args.executionPlan,
      stepResults: JSON.stringify({}),
      createdAt: now,
      updatedAt: now,
    });

    return {
      _id: executionId,
      organizationId: args.organizationId,
      status: "running",
      isNew: true,
    };
  },
});

export const recordExecutionComplete = internalMutation({
  args: {
    executionId: v.id("orchestrationExecutions"),
    status: v.union(
      v.literal("completed"),
      v.literal("escalated"),
      v.literal("waiting_for_approval"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    stepResults: v.string(),
    finalResponse: v.optional(v.string()),
    error: v.optional(v.string()),
    latencyMs: v.number(),
    totalTokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.executionId, {
      status: args.status,
      stepResults: args.stepResults,
      finalResponse: args.finalResponse,
      error: args.error,
      latencyMs: args.latencyMs,
      totalTokensUsed: args.totalTokensUsed,
      updatedAt: now,
      completedAt: now,
    });
  },
});

export const getByIdempotencyKey = internalQuery({
  args: {
    idempotencyKey: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db
      .query("orchestrationExecutions")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();

    if (!execution || execution.organizationId !== args.organizationId) {
      return null;
    }

    return execution;
  },
});
