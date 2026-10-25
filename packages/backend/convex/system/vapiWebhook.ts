import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal, components } from "../_generated/api";
import { saveMessage } from "@convex-dev/agent";
import {
  executeUnifiedRetrieval,
  detectAmbiguousVoiceIdentifier,
} from "./ai/rag/unifiedSearch";
import { Id } from "../_generated/dataModel";
import {
  isSafeOrganizationId,
  looksLikeConvexId,
  MAX_PROMPT_LENGTH,
  MAX_TRANSCRIPT_MESSAGES,
} from "../lib/requestSecurity";

// ---------------------------------------------------------------------------
// Spoken response formatter: removes raw markdown, tables, and bracketed links
// so ElevenLabs TTS produces fluid, natural speech.
// ---------------------------------------------------------------------------
function formatForSpeech(text: string): string {
  return (
    text
      // Remove markdown links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove standalone citations [Source: ...]
      .replace(/\[Source:[^\]]+\]/gi, "")
      // Remove markdown headers
      .replace(/#{1,6}\s+/g, "")
      // Remove bold/italics
      .replace(/(\*\*|\*|__|_)/g, "")
      // Remove code fences
      .replace(/```[\s\S]*?```/g, "")
      // Remove table pipes
      .replace(/\|/g, " ")
      // Collapse excess whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

export { formatForSpeech };

// ---------------------------------------------------------------------------
// Internal action: execute Multi-Agent Voice Orchestration with speech formatting
// ---------------------------------------------------------------------------
export const executeVoiceOrchestration = internalAction({
  args: {
    organizationId: v.string(),
    query: v.string(),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    if (
      !isSafeOrganizationId(args.organizationId) ||
      args.query.length > MAX_PROMPT_LENGTH
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Voice request is invalid",
      });
    }

    // 1. Spoken policy number ambiguity detection
    const ambiguity = detectAmbiguousVoiceIdentifier(args.query);
    if (ambiguity.isAmbiguous && ambiguity.suggestedClarification) {
      return ambiguity.suggestedClarification;
    }

    // 2. Bind the voice call to a real conversation before querying tenant data.
    let conversation: {
      _id: Id<"conversations">;
      organizationId: string;
      threadId: string;
      contactSessionId: Id<"contactSessions">;
    } | null = null;
    if (args.conversationId) {
      if (!looksLikeConvexId(args.conversationId)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Voice conversation is invalid",
        });
      }
      conversation = await ctx.runQuery(internal.system.conversations.getOne, {
        conversationId: args.conversationId as Id<"conversations">,
      });
      if (
        !conversation ||
        conversation.organizationId !== args.organizationId
      ) {
        throw new ConvexError({
          code: "UNAUTHORIZED",
          message: "Voice conversation organization mismatch",
        });
      }
    }

    // 3. If conversationId is valid, orchestrate through multi-agent orchestration layer
    if (conversation) {
      try {
        const { orchestrateConversationTurn } =
          await import("./ai/orchestration");
        const orchestrationResult = await orchestrateConversationTurn(ctx, {
          organizationId: args.organizationId,
          conversationId: conversation._id,
          threadId: conversation.threadId,
          contactSessionId: conversation.contactSessionId,
          prompt: args.query,
          channel: "voice",
          maxBudgetMs: 8000,
        });

        if (orchestrationResult.responseMessage) {
          return formatForSpeech(orchestrationResult.responseMessage);
        }
      } catch (err) {
        console.warn(
          "[VoiceOrchestration] Multi-agent orchestration fallback:",
          err,
        );
      }
    } else {
      return "I need an active support conversation before I can look up account or knowledge-base details.";
    }

    // 3. Fallback to unified hybrid retrieval for the bound conversation only
    const result = await executeUnifiedRetrieval(ctx, {
      organizationId: args.organizationId,
      query: args.query,
      limit: 3,
      source: "voice",
    });

    if (result.evidenceItems.length === 0) {
      return "I could not find specific details about that in our knowledge base. Would you like me to connect you with a human support specialist?";
    }

    const bestText = result.evidenceItems.map((e) => e.text).join(". ");
    const spoken = formatForSpeech(bestText);

    return (
      spoken ||
      "I found relevant information in our knowledge base, but I cannot summarize it right now."
    );
  },
});

// ---------------------------------------------------------------------------
// Internal action: execute RAG search for voice assistant with unified hybrid routing & ambiguity detection
// ---------------------------------------------------------------------------
export const executeVoiceSearch = internalAction({
  args: {
    organizationId: v.string(),
    query: v.string(),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    if (
      !isSafeOrganizationId(args.organizationId) ||
      args.query.length > MAX_PROMPT_LENGTH
    ) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Voice search request is invalid",
      });
    }

    if (!args.conversationId || !looksLikeConvexId(args.conversationId)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Voice search requires a conversation",
      });
    }

    const conversation = await ctx.runQuery(
      internal.system.conversations.getOne,
      { conversationId: args.conversationId as Id<"conversations"> },
    );
    if (!conversation || conversation.organizationId !== args.organizationId) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Voice conversation organization mismatch",
      });
    }

    // 1. Spoken policy number ambiguity detection
    const ambiguity = detectAmbiguousVoiceIdentifier(args.query);
    if (ambiguity.isAmbiguous && ambiguity.suggestedClarification) {
      return ambiguity.suggestedClarification;
    }

    // 2. Execute unified multi-format hybrid retrieval (same as chat)
    const result = await executeUnifiedRetrieval(ctx, {
      organizationId: args.organizationId,
      query: args.query,
      limit: 3,
      source: "voice",
    });

    if (result.evidenceItems.length === 0) {
      return "I could not find specific details about that in our knowledge base. Would you like me to connect you with a human support specialist?";
    }

    const bestText = result.evidenceItems.map((e) => e.text).join(". ");
    const spoken = formatForSpeech(bestText);

    return (
      spoken ||
      "I found relevant information in our knowledge base, but I cannot summarize it right now."
    );
  },
});

// ---------------------------------------------------------------------------
// Internal mutation: persist voice transcript messages into conversation thread
// ---------------------------------------------------------------------------
export const recordVoiceTranscript = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    transcriptMessages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        text: v.string(),
      }),
    ),
    vapiCallId: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;
    if (args.transcriptMessages.length > MAX_TRANSCRIPT_MESSAGES) return;

    let lastText = "";
    let lastRole = "assistant";
    const now = Date.now();

    for (const msg of args.transcriptMessages) {
      if (!msg.text || !msg.text.trim()) continue;
      lastText = msg.text.trim().slice(0, MAX_PROMPT_LENGTH);
      lastRole = msg.role;

      // Persist to agent thread
      await saveMessage(ctx, components.agent, {
        threadId: conversation.threadId,
        message: {
          role: msg.role,
          content: lastText,
        },
      });
    }

    if (lastText) {
      await ctx.db.patch(args.conversationId, {
        lastMessageText: `[Voice Call] ${lastText}`,
        lastMessageRole: lastRole,
        lastMessageAt: now,
      });
    }
  },
});
