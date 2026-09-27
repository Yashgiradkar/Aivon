import { createTool } from "@convex-dev/agent";
import z from "zod";
import { internal } from "../../../_generated/api";
import rag from "../rag";
import { normalizeSearchQuery } from "../rag/queryNormalizer";
import { rerankSearchResults } from "../rag/reranker";
import { MultiTenantRetrievalCache } from "../cache/retrievalCache";
import { logAIOperation } from "../observability/logger";

export const search = createTool({
  description: "Search the knowledge base for relevant information to help answer user questions",
  args: z.object({
    query: z
      .string()
      .describe("The search query to find relevant information"),
  }),
  handler: async (ctx, args) => {
    if (!ctx.threadId) {
      return "Missing thread ID";
    }

    const conversation = await ctx.runQuery(
      internal.system.conversations.getByThreadId,
      { threadId: ctx.threadId },
    );

    if (!conversation) {
      return "Conversation not found";
    }

    const orgId = conversation.organizationId;
    const normalized = normalizeSearchQuery(args.query);

    // 1. Check multi-tenant retrieval cache
    const cached = MultiTenantRetrievalCache.get(orgId, normalized || args.query);
    if (cached) {
      logAIOperation({
        event: "rag.search",
        organizationId: orgId,
        conversationId: conversation._id,
        threadId: ctx.threadId,
        details: { cacheHit: true, query: normalized },
      });
      return `Found information in knowledge base (${cached.titles.join(", ")}):\n\n${cached.resultText}`;
    }

    const startTime = Date.now();
    const searchResult = await rag.search(ctx, {
      namespace: orgId,
      query: normalized || args.query,
      limit: 6,
    });

    if (!searchResult.entries || searchResult.entries.length === 0) {
      return "No relevant information found in the knowledge base.";
    }

    // 2. Apply reranking to candidate entries
    const reranked = await rerankSearchResults(args.query, searchResult.entries, 3);

    const contextTitles = reranked.entries
      .map((e) => e.title || null)
      .filter((t): t is string => t !== null);

    const contextText = reranked.entries
      .map((e) => e.text || "")
      .filter((t) => t.length > 0)
      .join("\n\n");

    const finalResultText = contextText || searchResult.text;

    // 3. Populate cache
    MultiTenantRetrievalCache.set(orgId, normalized || args.query, finalResultText, contextTitles);

    logAIOperation({
      event: "rag.search",
      organizationId: orgId,
      conversationId: conversation._id,
      threadId: ctx.threadId,
      latencyMs: Date.now() - startTime,
      details: {
        cacheHit: false,
        retrievedCount: searchResult.entries.length,
        rerankedCount: reranked.entries.length,
      },
    });

    return `Found information in knowledge base (${contextTitles.join(", ")}):\n\n${finalResultText}`;
  },
});



