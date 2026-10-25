import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { isE164PhoneNumber, MAX_CALLBACK_SCHEDULE_MS } from "../lib/requestSecurity";

const AVG_CALL_DURATION_SECONDS = 180;

// ---------------------------------------------------------------------------
// Check organization agent availability & estimated wait before joining
// ---------------------------------------------------------------------------
export const getAvailability = query({
  args: {
    organizationId: v.string(),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.db.get(args.contactSessionId);
    if (
      !contactSession ||
      contactSession.expiresAt < Date.now() ||
      contactSession.organizationId !== args.organizationId
    ) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Invalid session",
      });
    }

    const availableAgents = await ctx.db
      .query("supportAgentAvailability")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "available"),
      )
      .collect();

    const waitingEntries = await ctx.db
      .query("supportQueue")
      .withIndex("by_organization_id_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "waiting"),
      )
      .collect();

    const activeAgentCount = availableAgents.length;
    const queueLength = waitingEntries.length;
    const estimatedWaitSeconds =
      queueLength === 0 && activeAgentCount > 0
        ? 0
        : Math.ceil(
            ((queueLength + 1) * AVG_CALL_DURATION_SECONDS) /
              Math.max(activeAgentCount, 1),
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
    if (
      conversation.contactSessionId !== contactSession._id ||
      conversation.organizationId !== contactSession.organizationId
    ) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Incorrect session",
      });
    }

    // Check if an active queue entry already exists for this conversation
    const existing = await ctx.db
      .query("supportQueue")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "waiting"),
          q.eq(q.field("status"), "offered"),
          q.eq(q.field("status"), "accepted"),
          q.eq(q.field("status"), "connecting"),
          q.eq(q.field("status"), "connected"),
        ),
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
        q
          .eq("organizationId", conversation.organizationId)
          .eq("status", "waiting"),
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
      priority: "normal",
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

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.contactSessionId !== contactSession._id)
      return null;

    const queueEntry = await ctx.db
      .query("supportQueue")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "cancelled"),
          q.neq(q.field("status"), "expired"),
        ),
      )
      .order("desc")
      .first();

    if (!queueEntry) {
      return null;
    }

    return {
      _id: queueEntry._id,
      status: queueEntry.status,
      position: queueEntry.position,
      estimatedWaitSeconds: queueEntry.estimatedWaitSeconds,
      assignedAgentName: queueEntry.assignedAgentName,
      isCallback: queueEntry.isCallback,
    };
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
    const contactSession = await ctx.db.get(args.contactSessionId);
    const queueEntry = await ctx.db.get(args.queueEntryId);
    if (
      !contactSession ||
      contactSession.expiresAt < Date.now() ||
      !queueEntry ||
      queueEntry.contactSessionId !== contactSession._id
    ) {
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
          .withIndex("by_organization_id_and_agent_id", (q) =>
            q
              .eq("organizationId", queueEntry.organizationId)
              .eq("agentId", queueEntry.assignedAgentId!),
        )
          .unique();

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
      },
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
    if (
      conversation.contactSessionId !== contactSession._id ||
      conversation.organizationId !== contactSession.organizationId
    ) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Incorrect session",
      });
    }

    const callbackPhoneNumber = args.callbackPhoneNumber.trim();
    if (!isE164PhoneNumber(callbackPhoneNumber)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "A valid E.164 callback number is required",
      });
    }

    const scheduledFor = args.scheduledFor || Date.now();
    if (
      !Number.isFinite(scheduledFor) ||
      scheduledFor < Date.now() - 60_000 ||
      scheduledFor > Date.now() + MAX_CALLBACK_SCHEDULE_MS
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Callback time must be within the next 7 days",
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
      scheduledFor,
      callbackPhoneNumber,
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
    const contactSession = await ctx.db.get(args.contactSessionId);
    const queueEntry = await ctx.db.get(args.queueEntryId);
    if (
      contactSession &&
      contactSession.expiresAt >= Date.now() &&
      queueEntry &&
      queueEntry.contactSessionId === contactSession._id
    ) {
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
      v.literal("failed"),
    ),
  },
  handler: async () => {
    // Queue/call state changes affect agent availability and must originate
    // from trusted server-side call processing, never an end-user browser.
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Call status is managed by the server",
    });
  },
});

// ---------------------------------------------------------------------------
// Customer: Fetch voice call logs for a specific conversation
// ---------------------------------------------------------------------------
export const getCallLogs = query({
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

    const calls = await ctx.db
      .query("supportCalls")
      .withIndex("by_conversation_id", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .collect();

    return calls.filter((c) => c.contactSessionId === args.contactSessionId);
  },
});
