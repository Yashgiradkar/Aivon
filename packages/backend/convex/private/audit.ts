import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";

export const getLineageByConversation = query({
  args: {
    conversationId: v.id("conversations"),
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

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Conversation not found or organization mismatch",
      });
    }

    const records = await ctx.db
      .query("ragLineageRecords")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .filter((q) => q.eq(q.field("organizationId"), orgId))
      .order("desc")
      .collect();

    return records;
  },
});

export const getAuditEventsByTrace = query({
  args: {
    traceId: v.string(),
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

    const events = await ctx.db
      .query("aiAuditEvents")
      .withIndex("by_trace_id", (q) => q.eq("traceId", args.traceId))
      .filter((q) => q.eq(q.field("organizationId"), orgId))
      .order("asc")
      .collect();

    return events;
  },
});

export const getAuditSummary = query({
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

    const recentLineage = await ctx.db
      .query("ragLineageRecords")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .take(100);

    const totalLineage = recentLineage.length;
    const withEvidenceCount = recentLineage.filter((r) => r.hasEvidence).length;
    const voiceCount = recentLineage.filter((r) => r.channel === "voice").length;
    const chatCount = recentLineage.filter((r) => r.channel === "chat").length;

    const totalLatency = recentLineage.reduce((acc, r) => acc + (r.latencyMs || 0), 0);
    const avgLatencyMs = totalLineage > 0 ? Math.round(totalLatency / totalLineage) : 0;
    const citationRate = totalLineage > 0 ? Math.round((withEvidenceCount / totalLineage) * 100) : 100;

    return {
      totalLineage,
      withEvidenceCount,
      voiceCount,
      chatCount,
      avgLatencyMs,
      citationRate,
    };
  },
});

