import { ConvexError, v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

const AVG_CALL_DURATION_SECONDS = 180;

// ---------------------------------------------------------------------------
// Check organization agent availability & estimated wait before joining
// ---------------------------------------------------------------------------
export const getAvailability = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const availableAgents = await ctx.db
      .query("supportAgentAvailability")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "available")
      )
      .collect();

    const waitingEntries = await ctx.db
      .query("supportQueue")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "waiting")
      )
      .collect();

    const activeAgentCount = availableAgents.length;
    const queueLength = waitingEntries.length;
    const estimatedWaitSeconds =
      queueLength === 0 && activeAgentCount > 0
        ? 0
        : Math.ceil(
            ((queueLength + 1) * AVG_CALL_DURATION_SECONDS) /
              Math.max(activeAgentCount, 1)
          );

    return {
      availableAgentsCount: activeAgentCount,
      waitingCustomersCount: queueLength,
      estimatedWaitSeconds,
      canConnectImmediately: activeAgentCount > 0 && queueLength === 0,
    };
  },
});

// ---------------------------------------------------------------------------
// Join the support queue
// ---------------------------------------------------------------------------
export const join = mutation({
  args: {
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
    priority: v.optional(
      v.union(v.literal("normal"), v.literal("high"), v.literal("urgent"))
    ),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId);
    if (!contactSession || contactSession.expiresAt < Date.now()) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Invalid session",
      });
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }

    // Check if an active queue entry already exists for this conversation
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

    // Mark conversation escalated
    await ctx.db.patch(args.conversationId, {
      status: "escalated",
    });

    // Count existing waiting entries to assign position
    const waitingEntries = await ctx.db
      .query("supportQueue")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", conversation.organizationId).eq("status", "waiting")
      )
      .collect();

    const position = waitingEntries.length + 1;
    const estimatedWaitSeconds = position * AVG_CALL_DURATION_SECONDS;

    const queueEntryId = await ctx.db.insert("supportQueue", {
      organizationId: conversation.organizationId,
      conversationId: args.conversationId,
      contactSessionId: args.contactSessionId,
      customerName: contactSession.name,
      customerEmail: contactSession.email,
      status: "waiting",
      priority: args.priority || "normal",
      position,
      joinedAt: Date.now(),
      estimatedWaitSeconds,
      lastSeenAt: Date.now(),
      isCallback: false,
    });

    // Trigger AI summary generation
    await ctx.scheduler.runAfter(0, internal.system.queue.generateSummary, {
      queueEntryId,
      conversationId: args.conversationId,
    });

    // Trigger atomic matcher to see if an agent is immediately available
    await ctx.scheduler.runAfter(0, internal.system.queue.matchAndAssign, {
      organizationId: conversation.organizationId,
    });

    return queueEntryId;
  },
});

// ---------------------------------------------------------------------------
// Real-time query for customer's active queue state
// ---------------------------------------------------------------------------
export const getQueueStatus = query({
  args: {
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId);
    if (!contactSession || contactSession.expiresAt < Date.now()) {
      return null;
    }

    const queueEntry = await ctx.db
      .query("supportQueue")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "cancelled"),
          q.neq(q.field("status"), "expired")
        )
      )
      .order("desc")
      .first();

    if (!queueEntry) {
      return null;
    }

    return queueEntry;
  },
});

// ---------------------------------------------------------------------------
// Leave or cancel queue
// ---------------------------------------------------------------------------
export const leave = mutation({
  args: {
    queueEntryId: v.id("supportQueue"),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const queueEntry = await ctx.db.get(args.queueEntryId);
    if (!queueEntry || queueEntry.contactSessionId !== args.contactSessionId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Invalid queue entry",
      });
    }

    await ctx.db.patch(args.queueEntryId, {
      status: "cancelled",
    });

    // If an agent was assigned, free up the agent
    if (queueEntry.assignedAgentId) {
      const agentRecord = await ctx.db
        .query("supportAgentAvailability")
        .withIndex("by_agent_id", (q) =>
          q.eq("agentId", queueEntry.assignedAgentId!)
        )
        .first();

      if (agentRecord) {
        await ctx.db.patch(agentRecord._id, {
          status: "available",
          currentConversationId: undefined,
          currentQueueEntryId: undefined,
        });
      }
    }

    // Recalculate remaining positions
    await ctx.scheduler.runAfter(
      0,
      internal.system.queue.recalculatePositions,
      {
        organizationId: queueEntry.organizationId,
      }
    );
  },
});

// ---------------------------------------------------------------------------
// Schedule a callback (ASAP or future time)
// ---------------------------------------------------------------------------
export const scheduleCallback = mutation({
  args: {
    conversationId: v.id("conversations"),
    contactSessionId: v.id("contactSessions"),
    scheduledFor: v.optional(v.number()),
    callbackPhoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId);
    if (!contactSession || contactSession.expiresAt < Date.now()) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Invalid session",
      });
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }

    const queueEntryId = await ctx.db.insert("supportQueue", {
      organizationId: conversation.organizationId,
      conversationId: args.conversationId,
      contactSessionId: args.contactSessionId,
      customerName: contactSession.name,
      customerEmail: contactSession.email,
      status: "waiting",
      priority: "normal",
      position: 1,
      joinedAt: Date.now(),
      estimatedWaitSeconds: 0,
      lastSeenAt: Date.now(),
      isCallback: true,
      scheduledFor: args.scheduledFor || Date.now(),
      callbackPhoneNumber: args.callbackPhoneNumber,
    });

    await ctx.scheduler.runAfter(0, internal.system.queue.generateSummary, {
      queueEntryId,
      conversationId: args.conversationId,
    });

    return queueEntryId;
  },
});

// ---------------------------------------------------------------------------
// Heartbeat to keep waiting queue entry active
// ---------------------------------------------------------------------------
export const heartbeat = mutation({
  args: {
    queueEntryId: v.id("supportQueue"),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const queueEntry = await ctx.db.get(args.queueEntryId);
    if (queueEntry && queueEntry.contactSessionId === args.contactSessionId) {
      await ctx.db.patch(args.queueEntryId, {
        lastSeenAt: Date.now(),
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Report call transition from client (connecting -> connected -> completed/failed)
// ---------------------------------------------------------------------------
export const updateCallStatus = mutation({
  args: {
    queueEntryId: v.id("supportQueue"),
    contactSessionId: v.id("contactSessions"),
    status: v.union(
      v.literal("connecting"),
      v.literal("connected"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const queueEntry = await ctx.db.get(args.queueEntryId);
    if (!queueEntry || queueEntry.contactSessionId !== args.contactSessionId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Invalid session",
      });
    }

    const patch: Record<string, unknown> = {
      status: args.status,
    };

    if (args.status === "connected") {
      patch.connectedAt = Date.now();
    } else if (args.status === "completed" || args.status === "failed") {
      patch.completedAt = Date.now();

      // Release agent
      if (queueEntry.assignedAgentId) {
        const agent = await ctx.db
          .query("supportAgentAvailability")
          .withIndex("by_agent_id", (q) =>
            q.eq("agentId", queueEntry.assignedAgentId!)
          )
          .first();

        if (agent) {
          await ctx.db.patch(agent._id, {
            status: "available",
            currentConversationId: undefined,
            currentQueueEntryId: undefined,
          });

          // Match next customer
          await ctx.scheduler.runAfter(
            0,
            internal.system.queue.matchAndAssign,
            {
              organizationId: queueEntry.organizationId,
            }
          );
        }
      }
    }

    await ctx.db.patch(args.queueEntryId, patch);
  },
});
