import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";

export const getLineageForConversation = query({
  args: {
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId);
    if (!contactSession || contactSession.expiresAt < Date.now()) {
      return [];
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      conversation.contactSessionId !== contactSession._id ||
      conversation.organizationId !== contactSession.organizationId
    ) {
      return [];
    }

    const records = await ctx.db
      .query("ragLineageRecords")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .filter((q) => q.eq(q.field("organizationId"), conversation.organizationId))
      .order("desc")
      .take(20);

    return records.map((record) => ({
      _id: record._id,
      traceId: record.traceId,
      userQuery: record.userQuery,
      channel: record.channel,
      effectiveStrategy: record.effectiveStrategy,
      retrievedEvidence: record.retrievedEvidence,
      hasEvidence: record.hasEvidence,
      timestamp: record.timestamp,
    }));
  },
});

