import { ConvexError, v } from "convex/values";
import { action, query } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { supportAgent } from "../system/ai/agents/supportAgent";
import { paginationOptsValidator } from "convex/server";
import { escalateConversation } from "../system/ai/tools/escalateConversation";
import { resolveConversation } from "../system/ai/tools/resolveConversation";
import { saveMessage } from "@convex-dev/agent";
import { search } from "../system/ai/tools/search";
import { sanitizeUserInput, validateAgentOutput, checkRateLimit } from "../system/ai/security";
import { logAIOperation } from "../system/ai/observability";
import { estimateTokens } from "../system/ai/context";

export const create = action({
  args: {
    prompt: v.string(),
    threadId: v.string(),
    contactSessionId: v.id("contactSessions"),
  },
  handler: async (ctx, args) => {
    const contactSession = await ctx.runQuery(
      internal.system.contactSessions.getOne,
      {
        contactSessionId: args.contactSessionId,
      }
    );

    if (!contactSession || contactSession.expiresAt < Date.now()) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Invalid session",
      });
    }

    const conversation = await ctx.runQuery(
      internal.system.conversations.getByThreadId,
      {
        threadId: args.threadId,
      },
    );

    if (!conversation) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }

    if (conversation.status === "resolved") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Conversation resolved",
      });
    }

    // Check message limit to protect token usage and save AI costs
    const widgetSettings = await ctx.runQuery(
      internal.system.widgetSettings.getByOrganizationId,
      {
        organizationId: conversation.organizationId,
      }
    );

    const maxMessages =
      widgetSettings?.maxMessagesPerConversation &&
      widgetSettings.maxMessagesPerConversation > 0
        ? widgetSettings.maxMessagesPerConversation
        : 20;

    try {
      const existingMessages = await supportAgent.listMessages(ctx, {
        threadId: args.threadId,
        paginationOpts: { numItems: maxMessages + 1, cursor: null },
      });
      if (existingMessages.page.length >= maxMessages) {
        throw new ConvexError({
          code: "LIMIT_REACHED",
          message: `Conversation limit reached (${maxMessages}/${maxMessages} messages). Please request a callback or contact a specialist.`,
        });
      }
    } catch (err) {
      if (err instanceof ConvexError) throw err;
    }

    // Rate limiting per contact session to prevent runaway loops or denial of service
    const rateLimit = checkRateLimit(args.contactSessionId, 30, 60000);
    if (!rateLimit.isAllowed) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "You are sending messages too quickly. Please wait a few seconds before trying again.",
      });
    }

    // Sanitize user input & screen for prompt injection attempts
    const sanitizedInput = sanitizeUserInput(args.prompt);

    // Refresh contact session asynchronously so message creation TTFB is immediate
    await ctx.scheduler.runAfter(0, internal.system.contactSessions.refresh, {
      contactSessionId: args.contactSessionId,
    });

    const subscription = await ctx.runQuery(
      internal.system.subscriptions.getByOrganizationId,
      {
        organizationId: conversation.organizationId,
      },
    );

    const isDemo = conversation.organizationId.toLowerCase().includes("demo");
    const isSubscribed = subscription?.status === "active" || isDemo;

    const shouldTriggerAgent =
      conversation.status === "unresolved" && isSubscribed;

    const startTime = Date.now();
    const cleanPrompt = sanitizedInput.sanitizedText;

    // Write the user message and trigger AI, then denormalize the last message preview
    if (shouldTriggerAgent) {
      const response = await supportAgent.generateText(
        ctx,
        { threadId: args.threadId },
        {
          prompt: cleanPrompt,
          tools: {
            escalateConversationTool: escalateConversation,
            resolveConversationTool: resolveConversation,
            searchTool: search,
          }
        },
      );

      // Validate output against system leak guardrails
      const validated = validateAgentOutput(response.text);
      const lastText = validated.sanitizedResponse || cleanPrompt;

      const inputTokens = estimateTokens(cleanPrompt);
      const outputTokens = estimateTokens(validated.sanitizedResponse);
      const latencyMs = Date.now() - startTime;

      logAIOperation({
        event: "llm.response",
        organizationId: conversation.organizationId,
        conversationId: conversation._id,
        threadId: args.threadId,
        model: "gpt-4o-mini",
        latencyMs,
        inputTokens,
        outputTokens,
        details: {
          isSuspiciousInput: sanitizedInput.isSuspicious,
          outputViolations: validated.violations,
        },
      });

      // Update last message with the assistant's response (or prompt if result is empty)
      await ctx.runMutation(internal.system.conversations.updateLastMessage, {
        conversationId: conversation._id,
        lastMessageText: lastText,
        lastMessageRole: response.text ? "assistant" : "user",
        lastMessageAt: Date.now(),
      });
    } else {
      await saveMessage(ctx, components.agent, {
        threadId: args.threadId,
        message: {
          role: "user",
          content: cleanPrompt,
        },
      });
      await ctx.runMutation(internal.system.conversations.updateLastMessage, {
        conversationId: conversation._id,
        lastMessageText: cleanPrompt,
        lastMessageRole: "user",
        lastMessageAt: Date.now(),
      });
    }
  },
});

export const getMany = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
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
