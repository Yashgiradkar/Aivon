import { ConvexError, v } from "convex/values";
import { generateText } from "ai";
import { action, mutation, query } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { supportAgent } from "../system/ai/agents/supportAgent";
import { paginationOptsValidator } from "convex/server";
import { saveMessage } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { OPERATOR_MESSAGE_ENHANCEMENT_PROMPT } from "../system/ai/constants";
import { assertBoundedText, MAX_OPERATOR_PROMPT_LENGTH } from "../lib/requestSecurity";
import { sanitizeUserInput } from "../system/ai/security";

export const enhanceResponse = action({
  args: {
    prompt: v.string(),
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

    const subscription = await ctx.runQuery(
      internal.system.subscriptions.getByOrganizationId,
      {
        organizationId: orgId,
      },
    );

    if (subscription?.status !== "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Missing subscription"
      });
    }

    const admission = await ctx.runMutation(
      internal.system.rateLimits.checkAndAdmit,
      {
        organizationId: orgId,
        estimatedTokens: 800,
      },
    );
    if (!admission.allowed) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Organization rate limit reached. Please wait and try again.",
      });
    }

    const prompt = sanitizeUserInput(
      assertBoundedText(args.prompt, MAX_OPERATOR_PROMPT_LENGTH, "Prompt"),
      MAX_OPERATOR_PROMPT_LENGTH,
    ).sanitizedText;

    const response = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        {
          role: "system",
          content: OPERATOR_MESSAGE_ENHANCEMENT_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return response.text;
  },
});

export const create = mutation({
  args: {
    prompt: v.string(),
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
        message: "Conversation not found",
      });
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Invalid Organization ID",
      });
    }

    if (conversation.status === "resolved") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Conversation resolved",
      });
    }

    const prompt = assertBoundedText(
      args.prompt,
      MAX_OPERATOR_PROMPT_LENGTH,
      "Message",
    );

    if (conversation.status === "unresolved") {
      await ctx.db.patch(args.conversationId, {
        status: "escalated",
      });
    }

    await saveMessage(ctx, components.agent, {
      threadId: conversation.threadId,
      // TODO: Check if "agentName" is needed or not
      agentName: identity.familyName,
      message: {
        role: "assistant",
        content: prompt,
      },
    });

    // Denormalize last message preview onto conversation for fast list rendering
    await ctx.db.patch(args.conversationId, {
      lastMessageText: prompt,
      lastMessageRole: "assistant",
      lastMessageAt: Date.now(),
    });
  },
});

export const getMany = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
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

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }

    if (conversation.organizationId !== orgId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Invalid Organization ID",
      });
    }

    try {
      const paginated = await supportAgent.listMessages(ctx, {
        threadId: args.threadId,
        paginationOpts: args.paginationOpts,
      });

      return paginated;
    } catch {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }
  },
});
