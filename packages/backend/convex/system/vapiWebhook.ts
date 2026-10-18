import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal, components } from "../_generated/api";
import rag from "./ai/rag";
import { normalizeSearchQuery } from "./ai/rag/queryNormalizer";
import { rerankSearchResults } from "./ai/rag/reranker";
import { saveMessage } from "@convex-dev/agent";
import { logAIOperation } from "./ai/observability/logger";
import { Id } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// Spoken response formatter: removes raw markdown, tables, and bracketed links
// so ElevenLabs TTS produces fluid, natural speech.
// ---------------------------------------------------------------------------
function formatForSpeech(text: string): string {
  return text
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
    .trim();
}

// ---------------------------------------------------------------------------
// Internal action: execute RAG search for voice assistant
// ---------------------------------------------------------------------------
export const executeVoiceSearch = internalAction({
  args: {
    organizationId: v.string(),
    query: v.string(),
    conversationId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const normalized = normalizeSearchQuery(args.query);
    const searchResult = await rag.search(ctx, {
      namespace: args.organizationId,
      query: normalized || args.query,
      limit: 4,
    });

    if (!searchResult.entries || searchResult.entries.length === 0) {
      return "I could not find specific details about that in our knowledge base. Would you like me to connect you with a human support specialist?";
    }

    const reranked = await rerankSearchResults(args.query, searchResult.entries, 2);
    const bestText = reranked.entries.map((e) => e.text).join(". ");
    const spoken = formatForSpeech(bestText);

    logAIOperation({
      event: "rag.search",
      organizationId: args.organizationId,
      details: { source: "voice", query: args.query, hitsCount: searchResult.entries.length },
    });

    return spoken || "I found relevant information in our knowledge base, but I cannot summarize it right now.";
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
      })
    ),
    vapiCallId: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) return;

    let lastText = "";
    let lastRole = "assistant";
    const now = Date.now();

    for (const msg of args.transcriptMessages) {
      if (!msg.text || !msg.text.trim()) continue;
      lastText = msg.text.trim();
      lastRole = msg.role;

      // Persist to agent thread
      await saveMessage(ctx, components.agent, {
        threadId: conversation.threadId,
        message: {
          role: msg.role,
          content: msg.text.trim(),
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
