import { v } from "convex/values";
import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const AVG_CALL_DURATION_SECONDS = 180; // 3 minutes per call estimate

// ---------------------------------------------------------------------------
// Enqueue customer into support queue (invoked by AI escalation or widget)
// ---------------------------------------------------------------------------
export const enqueue = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
    organizationId: v.string(),
    customerName: v.string(),
    customerEmail: v.string(),
    priority: v.optional(
      v.union(v.literal("normal"), v.literal("high"), v.literal("urgent"))
    ),
  },
  handler: async (ctx, args) => {
    // Check if active queue entry already exists
    const existing = await ctx.db
      .query("supportQueue")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "waiting"),
          q.eq(q.field("status"), "offered"),
          q.eq(q.field("status"), "accepted"),
          q.eq(q.field("status"), "connecting"),
          q.eq(q.field("status"), "connected")
        )
      )
      .first();

    if (existing) {
      return existing._id;
    }

    // Count existing waiting entries
    const waitingEntries = await ctx.db
      .query("supportQueue")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "waiting")
      )
      .collect();

    const position = waitingEntries.length + 1;
    const estimatedWaitSeconds = position * AVG_CALL_DURATION_SECONDS;

    const queueEntryId = await ctx.db.insert("supportQueue", {
      organizationId: args.organizationId,
      conversationId: args.conversationId,
      contactSessionId: args.contactSessionId,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      status: "waiting",
      priority: args.priority || "high",
      position,
      joinedAt: Date.now(),
      estimatedWaitSeconds,
      lastSeenAt: Date.now(),
      isCallback: false,
    });

    // Generate AI summary for human agent
    await ctx.scheduler.runAfter(0, internal.system.queue.generateSummary, {
      queueEntryId,
      conversationId: args.conversationId,
    });

    // Trigger matcher
    await ctx.scheduler.runAfter(0, internal.system.queue.matchAndAssign, {
      organizationId: args.organizationId,
    });

    return queueEntryId;
  },
});

// ---------------------------------------------------------------------------
// Match next eligible customer to an available agent (FIFO + Priority)
// ---------------------------------------------------------------------------
export const matchAndAssign = internalMutation({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Find all available agents for this organization
    const availableAgents = await ctx.db
      .query("supportAgentAvailability")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "available")
      )
      .collect();

    if (availableAgents.length === 0) {
      return { matched: false, reason: "No agents available" };
    }

    // 2. Find waiting queue entries for this organization
    const waitingEntries = await ctx.db
      .query("supportQueue")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "waiting")
      )
      .collect();

    if (waitingEntries.length === 0) {
      return { matched: false, reason: "No waiting customers" };
    }

    // Sort by priority (urgent=3, high=2, normal=1) descending, then joinedAt ascending (FIFO)
    const priorityWeight = { urgent: 3, high: 2, normal: 1 };
    waitingEntries.sort((a, b) => {
      const pDiff =
        (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return a.joinedAt - b.joinedAt;
    });

    const candidateCustomer = waitingEntries[0];
    const candidateAgent = availableAgents[0];

    if (!candidateCustomer || !candidateAgent) {
      return { matched: false, reason: "No match candidate found" };
    }

    // Atomically reserve the customer and agent
    await ctx.db.patch(candidateCustomer._id, {
      status: "accepted",
      assignedAgentId: candidateAgent.agentId,
      assignedAgentName: candidateAgent.agentName,
      offeredAt: Date.now(),
    });

    await ctx.db.patch(candidateAgent._id, {
      status: "on_call",
      currentConversationId: candidateCustomer.conversationId,
      currentQueueEntryId: candidateCustomer._id,
      lastActiveAt: Date.now(),
    });

    // Create a supportCall record
    await ctx.db.insert("supportCalls", {
      organizationId: args.organizationId,
      queueEntryId: candidateCustomer._id,
      conversationId: candidateCustomer.conversationId,
      contactSessionId: candidateCustomer.contactSessionId,
      agentId: candidateAgent.agentId,
      status: "initiating",
      startedAt: Date.now(),
    });

    return {
      matched: true,
      queueEntryId: candidateCustomer._id,
      agentId: candidateAgent.agentId,
    };
  },
});

// ---------------------------------------------------------------------------
// Recalculate queue positions and estimated wait times
// ---------------------------------------------------------------------------
export const recalculatePositions = internalMutation({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const waitingEntries = await ctx.db
      .query("supportQueue")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "waiting")
      )
      .collect();

    const availableAgents = await ctx.db
      .query("supportAgentAvailability")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "available")
      )
      .collect();

    const activeAgentCount = Math.max(availableAgents.length, 1);

    const priorityWeight = { urgent: 3, high: 2, normal: 1 };
    waitingEntries.sort((a, b) => {
      const pDiff =
        (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return a.joinedAt - b.joinedAt;
    });

    for (let index = 0; index < waitingEntries.length; index++) {
      const entry = waitingEntries[index];
      if (!entry) continue;

      const position = index + 1;
      const estimatedWaitSeconds = Math.ceil(
        (position * AVG_CALL_DURATION_SECONDS) / activeAgentCount
      );

      if (
        entry.position !== position ||
        entry.estimatedWaitSeconds !== estimatedWaitSeconds
      ) {
        await ctx.db.patch(entry._id, {
          position,
          estimatedWaitSeconds,
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Generate AI conversation summary for zero-explanation handoff
// ---------------------------------------------------------------------------
export const generateSummary = internalAction({
  args: {
    queueEntryId: v.id("supportQueue"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.runQuery(
      internal.system.conversations.getOne,
      {
        conversationId: args.conversationId,
      }
    );

    if (!conversation) return;

    try {
      const response = await generateText({
        model: openai("gpt-4o-mini"),
        system:
          "You are an AI support assistant handoff summarizer. Summarize the customer's problem, actions attempted, key context, and the escalation reason in 3-4 concise bullet points for a human operator.",
        prompt: `Generate an escalation summary for conversation ${args.conversationId} with threadId ${conversation.threadId}.`,
      });

      await ctx.runMutation(internal.system.queue.setSummary, {
        queueEntryId: args.queueEntryId,
        summary: response.text,
      });
    } catch (err) {
      console.error("[Queue] Failed to generate AI summary:", err);
    }
  },
});

export const setSummary = internalMutation({
  args: {
    queueEntryId: v.id("supportQueue"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueEntryId, {
      aiSummary: args.summary,
    });
  },
});

// ---------------------------------------------------------------------------
// Cleanup stale queue entries (heartbeat expired > 2 minutes)
// ---------------------------------------------------------------------------
export const cleanupStaleEntries = internalMutation({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    const waitingEntries = await ctx.db
      .query("supportQueue")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "waiting")
      )
      .collect();

    for (const entry of waitingEntries) {
      if (!entry.isCallback && entry.lastSeenAt < twoMinutesAgo) {
        await ctx.db.patch(entry._id, {
          status: "expired",
        });
      }
    }
  },
});
