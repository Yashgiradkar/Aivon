import { ConvexError, v } from "convex/values";
import { action, query } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { supportAgent } from "../system/ai/agents/supportAgent";
import { paginationOptsValidator } from "convex/server";
import { escalateConversation } from "../system/ai/tools/escalateConversation";
import { resolveConversation } from "../system/ai/tools/resolveConversation";
import { saveMessage } from "@convex-dev/agent";
import { search } from "../system/ai/tools/search";
import { sanitizeUserInput, validateAgentOutput, checkRateLimit, ModerationPipeline } from "../system/ai/security";
import { logAIOperation } from "../system/ai/observability";
import { estimateTokens } from "../system/ai/context";
import { MemoryManagerLogic } from "../system/ai/memory/memoryManager";
import { SemanticCacheLogic } from "../system/ai/cache/semanticCache";
import { orchestrateConversationTurn } from "../system/ai/orchestration";

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
    const sessionRateLimit = checkRateLimit(args.contactSessionId, 30, 60000);
    if (!sessionRateLimit.isAllowed) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "You are sending messages too quickly. Please wait a few seconds before trying again.",
      });
    }

    // Tenant-level distributed rate limit admission (Free / Pro / Enterprise)
    const tenantAdmission = await ctx.runMutation(internal.system.rateLimits.checkAndAdmit, {
      organizationId: conversation.organizationId,
      estimatedTokens: 600,
    });
    if (!tenantAdmission.allowed) {
      const quotaExceeded = "reason" in tenantAdmission && tenantAdmission.reason === "QUOTA_EXHAUSTED";
      throw new ConvexError({
        code: quotaExceeded ? "QUOTA_EXHAUSTED" : "RATE_LIMITED",
        message: quotaExceeded
          ? "Monthly AI token quota exceeded for your organization's subscription plan. Please upgrade to continue."
          : "Organization rate limit reached. Please wait a moment before sending more messages.",
      });
    }

    // Multi-stage input moderation
    const moderation = ModerationPipeline.moderateInput(args.prompt);
    if (moderation.flagged && moderation.riskLevel === "critical") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Your message violates safety guidelines and cannot be processed.",
      });
    }

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
    const cleanPrompt = moderation.sanitizedText;

    // Fetch active long-term memories for this customer
    const customerIdentifier = contactSession.email || String(args.contactSessionId);
    let promptForAgent = cleanPrompt;

    if (shouldTriggerAgent) {
      const orchestration = await orchestrateConversationTurn(ctx, {
        organizationId: conversation.organizationId,
        conversationId: conversation._id,
        threadId: args.threadId,
        contactSessionId: args.contactSessionId,
        prompt: cleanPrompt,
        channel: "chat",
      });

      const lastText = orchestration.responseMessage;
      const totalTokensUsed = orchestration.totalTokensUsed;

      // Update last message with the assistant's response for real-time reactive subscription updates
      await ctx.runMutation(internal.system.conversations.updateLastMessage, {
        conversationId: conversation._id,
        lastMessageText: lastText,
        lastMessageRole: "assistant",
        lastMessageAt: Date.now(),
      });

      // Reconcile actual token consumption in distributed rate limiter
      await ctx.runMutation(internal.system.rateLimits.reconcileTokens, {
        organizationId: conversation.organizationId,
        estimatedTokensReserved: 600,
        actualTokensUsed: totalTokensUsed,
      });

      // Asynchronously enqueue durable memory extraction job
      await ctx.runMutation(internal.system.jobs.enqueueJob, {
        organizationId: conversation.organizationId,
        jobType: "memory_extraction",
        payload: JSON.stringify({
          organizationId: conversation.organizationId,
          customerIdentifier,
          conversationId: conversation._id,
          text: `Customer: ${cleanPrompt}\nAssistant: ${lastText}`,
        }),
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
