import { createTool } from "@convex-dev/agent";
import z from "zod";
import { internal } from "../../../_generated/api";
import {
  executeUnifiedRetrieval,
  type EvidenceItem,
  detectQueryIntent,
  type UnifiedSearchResult,
} from "../rag/unifiedSearch";

export type { EvidenceItem, UnifiedSearchResult };
export { detectQueryIntent };

export const search = createTool({
  description:
    "Search the organization's verified multi-format knowledge base (using query-routed hybrid BM25 and vector retrieval) to answer user questions.",
  args: z.object({
    query: z
      .string()
      .describe("The search query to find relevant information in the knowledge base"),
  }),
  handler: async (ctx, args) => {
    if (!ctx.threadId) {
      return "Missing thread ID";
    }

    const conversation = await ctx.runQuery(
      internal.system.conversations.getByThreadId,
      { threadId: ctx.threadId }
    );

    if (!conversation) {
      return "Conversation not found";
    }

    const result = await executeUnifiedRetrieval(ctx, {
      organizationId: conversation.organizationId,
      query: args.query,
      conversationId: conversation._id,
      threadId: ctx.threadId,
      source: "chat",
    });

    return result.finalResultText;
  },
});
