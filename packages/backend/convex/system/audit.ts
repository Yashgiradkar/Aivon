import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { maskPIIForLogging } from "./ai/security/sanitizer";

export const recordAuditEvent = internalMutation({
  args: {
    organizationId: v.string(),
    traceId: v.string(),
    conversationId: v.optional(v.id("conversations")),
    threadId: v.optional(v.string()),
    contactSessionId: v.optional(v.id("contactSessions")),
    channel: v.union(
      v.literal("chat"),
      v.literal("voice"),
      v.literal("operator"),
      v.literal("system"),
    ),
    eventType: v.string(),
    stage: v.string(),
    status: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("warning"),
      v.literal("blocked"),
    ),
    model: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    error: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const error = args.error ? maskPIIForLogging(args.error) : undefined;
    await ctx.db.insert("aiAuditEvents", {
      ...args,
      error,
      timestamp: Date.now(),
    });
  },
});

export const recordLineage = internalMutation({
  args: {
    organizationId: v.string(),
    traceId: v.string(),
    conversationId: v.optional(v.id("conversations")),
    threadId: v.optional(v.string()),
    channel: v.union(
      v.literal("chat"),
      v.literal("voice"),
      v.literal("operator"),
    ),
    userQuery: v.string(),
    effectiveStrategy: v.string(),
    retrievedEvidence: v.array(
      v.object({
        evidenceId: v.string(),
        documentId: v.string(),
        documentName: v.string(),
        pageNumber: v.optional(v.number()),
        section: v.optional(v.string()),
        chunkId: v.optional(v.string()),
        contentType: v.string(),
        score: v.number(),
        snippet: v.string(),
        retrievalSource: v.string(),
      }),
    ),
    generatedResponse: v.string(),
    speechFormattedResponse: v.optional(v.string()),
    model: v.string(),
    voiceMetadata: v.optional(
      v.object({
        provider: v.optional(v.string()),
        voiceId: v.optional(v.string()),
        modelId: v.optional(v.string()),
        audioDurationSeconds: v.optional(v.number()),
      }),
    ),
    latencyMs: v.number(),
    tokensUsed: v.number(),
    hasEvidence: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ragLineageRecords", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getLineageByConversation = internalQuery({
  args: {
    organizationId: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ragLineageRecords")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .filter((q) => q.eq(q.field("organizationId"), args.organizationId))
      .order("desc")
      .collect();
  },
});

export const getEventsByTrace = internalQuery({
  args: {
    organizationId: v.string(),
    traceId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiAuditEvents")
      .withIndex("by_trace_id", (q) => q.eq("traceId", args.traceId))
      .filter((q) => q.eq(q.field("organizationId"), args.organizationId))
      .order("asc")
      .collect();
  },
});

