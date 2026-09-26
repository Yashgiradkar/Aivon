import { mutation, query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, PaginationResult } from "convex/server";
import { Doc } from "../_generated/dataModel";

export const updateStatus = mutation({
  args: {
    conversationId: v.id("conversations"),
    status: v.union(
      v.literal("unresolved"),
      v.literal("escalated"),
      v.literal("resolved")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
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

    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found"
      });
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORZIED",
        message: "Invalid Organization ID",
      });
    }

    await ctx.db.patch(args.conversationId, {
      status: args.status,
    });
  },
});

export const getOne = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
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

    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found"
      });
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORZIED",
        message: "Invalid Organization ID",
      });
    }

    const contactSession = await ctx.db.get(conversation.contactSessionId);

    if (!contactSession) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Contact Session not found"
      });
    }

    return {
      ...conversation,
      contactSession,
    };
  },
});

export const getMany = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("unresolved"),
        v.literal("escalated"),
        v.literal("resolved")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
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

    let conversations: PaginationResult<Doc<"conversations">>;

    if (args.status) {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_status_and_organization_id", (q) => 
          q
            .eq(
              "status",
              args.status as Doc<"conversations">["status"],
            )
            .eq("organizationId", orgId)
        )
        .order("desc")
        .paginate(args.paginationOpts)
    } else {
      conversations = await ctx.db
        .query("conversations")
        .withIndex("by_organization_id", (q) => q.eq("organizationId", orgId))
        .order("desc")
        .paginate(args.paginationOpts)
    }

    // Batch fetch contact sessions to eliminate redundant DB roundtrips
    const sessionIds = Array.from(
      new Set(conversations.page.map((c) => c.contactSessionId))
    );
    const sessions = await Promise.all(
      sessionIds.map((id) => ctx.db.get(id))
    );
    const sessionMap = new Map(
      sessions
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    );

    // Use denormalized lastMessage fields — zero extra DB calls
    const conversationsWithAdditionalData = conversations.page
      .map((conversation) => {
        const contactSession = sessionMap.get(conversation.contactSessionId);
        if (!contactSession) return null;

        // Shape the denormalized preview into the legacy lastMessage structure
        // so the ConversationsPanel UI needs zero changes.
        const lastMessage = conversation.lastMessageText
          ? {
              text: conversation.lastMessageText,
              message: { role: conversation.lastMessageRole ?? "user" },
              _creationTime: conversation.lastMessageAt ?? conversation._creationTime,
            }
          : null;

        return {
          ...conversation,
          lastMessage,
          contactSession,
        };
      })
      .filter((conv): conv is NonNullable<typeof conv> => conv !== null);

    return {
      ...conversations,
      page: conversationsWithAdditionalData,
    };
  },
});
