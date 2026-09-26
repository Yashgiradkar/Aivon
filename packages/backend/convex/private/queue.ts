import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

// ---------------------------------------------------------------------------
// Operator: Real-time list of waiting & active queue entries
// ---------------------------------------------------------------------------
export const getQueueList = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("waiting"),
        v.literal("accepted"),
        v.literal("connected"),
        v.literal("all")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const orgId = identity.orgId as string;

    const entries = await ctx.db
      .query("supportQueue")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .collect();

    if (!args.status || args.status === "all") {
      return entries.filter(
        (e) =>
          e.status === "waiting" ||
          e.status === "accepted" ||
          e.status === "connecting" ||
          e.status === "connected"
      );
    }

    return entries.filter((e) => e.status === args.status);
  },
});

// ---------------------------------------------------------------------------
// Operator: Set agent presence (available | busy | offline)
// ---------------------------------------------------------------------------
export const setAgentPresence = mutation({
  args: {
    status: v.union(
      v.literal("available"),
      v.literal("busy"),
      v.literal("offline")
    ),
    skills: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const orgId = identity.orgId as string;
    const agentId = identity.subject;
    const agentName =
      identity.name ||
      `${identity.givenName ?? ""} ${identity.familyName ?? ""}`.trim() ||
      "Operator";
    const agentEmail = identity.email ?? "";

    const existing = await ctx.db
      .query("supportAgentAvailability")
      .withIndex("by_agent_id", (q) => q.eq("agentId", agentId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        agentName,
        agentEmail,
        skills: args.skills ?? existing.skills,
        lastActiveAt: Date.now(),
      });
    } else {
      await ctx.db.insert("supportAgentAvailability", {
        organizationId: orgId,
        agentId,
        agentName,
        agentEmail,
        status: args.status,
        skills: args.skills ?? [],
        lastActiveAt: Date.now(),
      });
    }

    // If marked available, trigger matcher for any waiting customers
    if (args.status === "available") {
      await ctx.scheduler.runAfter(0, internal.system.queue.matchAndAssign, {
        organizationId: orgId,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Operator: Get current agent presence & assigned call
// ---------------------------------------------------------------------------
export const getAgentPresence = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.orgId) {
      return null;
    }

    const agentId = identity.subject;

    return await ctx.db
      .query("supportAgentAvailability")
      .withIndex("by_agent_id", (q) => q.eq("agentId", agentId))
      .first();
  },
});

// ---------------------------------------------------------------------------
// Operator: Manually accept / claim a waiting queue entry
// ---------------------------------------------------------------------------
export const acceptQueueEntry = mutation({
  args: {
    queueEntryId: v.id("supportQueue"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const orgId = identity.orgId as string;
    const agentId = identity.subject;
    const agentName =
      identity.name ||
      `${identity.givenName ?? ""} ${identity.familyName ?? ""}`.trim() ||
      "Operator";

    const queueEntry = await ctx.db.get(args.queueEntryId);
    if (!queueEntry || queueEntry.organizationId !== orgId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Queue entry not found",
      });
    }

    if (queueEntry.status !== "waiting") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Customer is no longer waiting",
      });
    }

    // Reserve customer
    await ctx.db.patch(args.queueEntryId, {
      status: "accepted",
      assignedAgentId: agentId,
      assignedAgentName: agentName,
      offeredAt: Date.now(),
    });

    // Update agent presence
    const agentRecord = await ctx.db
      .query("supportAgentAvailability")
      .withIndex("by_agent_id", (q) => q.eq("agentId", agentId))
      .first();

    if (agentRecord) {
      await ctx.db.patch(agentRecord._id, {
        status: "on_call",
        currentConversationId: queueEntry.conversationId,
        currentQueueEntryId: queueEntry._id,
        lastActiveAt: Date.now(),
      });
    }

    return queueEntry;
  },
});

// ---------------------------------------------------------------------------
// Operator: Complete call and free up agent
// ---------------------------------------------------------------------------
export const completeQueueEntry = mutation({
  args: {
    queueEntryId: v.id("supportQueue"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Organization not found",
      });
    }

    const queueEntry = await ctx.db.get(args.queueEntryId);
    if (!queueEntry) return;

    await ctx.db.patch(args.queueEntryId, {
      status: "completed",
      completedAt: Date.now(),
    });

    const agentId = identity.subject;
    const agentRecord = await ctx.db
      .query("supportAgentAvailability")
      .withIndex("by_agent_id", (q) => q.eq("agentId", agentId))
      .first();

    if (agentRecord) {
      await ctx.db.patch(agentRecord._id, {
        status: "available",
        currentConversationId: undefined,
        currentQueueEntryId: undefined,
        lastActiveAt: Date.now(),
      });

      // Match next customer
      await ctx.scheduler.runAfter(0, internal.system.queue.matchAndAssign, {
        organizationId: identity.orgId as string,
      });
    }
  },
});
