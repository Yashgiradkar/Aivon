import { createTool } from "@convex-dev/agent";
import z from "zod";
import { internal } from "../../../_generated/api";
import rag from "../rag";
import { normalizeSearchQuery } from "../rag/queryNormalizer";
import { rerankSearchResults } from "../rag/reranker";
import { MultiTenantRetrievalCache } from "../cache/retrievalCache";
import { logAIOperation } from "../observability/logger";

export interface EvidenceItem {
  evidenceId: string;
  sourceDoc: string;
  contentType: "table" | "chart" | "structured_data" | "prose";
  section?: string;
  score: number;
  text: string;
}

export function detectQueryIntent(query: string): "table_lookup" | "chart_metrics" | "prose" {
  const lower = query.toLowerCase();
  if (
    lower.includes("price") ||
    lower.includes("pricing") ||
    lower.includes("cost") ||
    lower.includes("table") ||
    lower.includes("plan") ||
    lower.includes("tier") ||
    lower.includes("compare") ||
    lower.includes("limit") ||
    lower.includes("refund period")
  ) {
    return "table_lookup";
  }
  if (
    lower.includes("chart") ||
    lower.includes("graph") ||
    lower.includes("trend") ||
    lower.includes("revenue") ||
    lower.includes("monthly") ||
    lower.includes("axis") ||
    lower.includes("growth")
  ) {
    return "chart_metrics";
  }
  return "prose";
}

export const search = createTool({
  description: "Search the organization's verified multi-format knowledge base (including tables, charts, and policy documents) to answer user questions.",
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
      { threadId: ctx.threadId },
    );

    if (!conversation) {
      return "Conversation not found";
    }

    const orgId = conversation.organizationId;
    const normalized = normalizeSearchQuery(args.query);
    const intent = detectQueryIntent(args.query);

    // 1. Check multi-tenant retrieval cache
    const cached = MultiTenantRetrievalCache.get(orgId, normalized || args.query);
    if (cached) {
      logAIOperation({
        event: "rag.search",
        organizationId: orgId,
        conversationId: conversation._id,
        threadId: ctx.threadId,
        details: { cacheHit: true, query: normalized, intent },
      });
      return cached.resultText;
    }

    const startTime = Date.now();
    // Retrieve candidates with higher limit to enable effective reranking
    const searchResult = await rag.search(ctx, {
      namespace: orgId,
      query: normalized || args.query,
      limit: 6,
    });

    if (!searchResult.entries || searchResult.entries.length === 0) {
      return "NO_RELEVANT_EVIDENCE: No relevant information was found in the knowledge base. State that you do not have specific information and offer to connect the customer with a human support specialist.";
    }

    // 2. Structure-aware candidate reranking
    const reranked = await rerankSearchResults(args.query, searchResult.entries, 4);

    const contextTitles = reranked.entries
      .map((e) => e.title || null)
      .filter((t): t is string => t !== null);

    // 3. Format structured evidence items with citation anchors and content badges
    const evidenceItems: EvidenceItem[] = reranked.entries.map((entry, idx) => {
      const text = entry.text || "";
      let contentType: EvidenceItem["contentType"] = "prose";
      if (text.includes("Table:") || text.includes("Data Records:") || text.includes("|")) {
        contentType = "table";
      } else if (text.includes("Chart:") || text.includes("Plotted Data Points:")) {
        contentType = "chart";
      } else if (text.includes("Structured Record")) {
        contentType = "structured_data";
      }

      const sectionMatch = text.match(/\[Section:\s*([^\]]+)\]/);
      const section = sectionMatch?.[1];

      return {
        evidenceId: `EVD-${idx + 1}`,
        sourceDoc: (entry.title as string) || "Knowledge Document",
        contentType,
        section,
        score: typeof entry.combinedScore === "number" ? entry.combinedScore : (typeof entry.score === "number" ? entry.score : 0.5),
        text,
      };
    });


    // Check evidence confidence (abstention safeguard)
    const highestScore = Math.max(...evidenceItems.map((e) => e.score));
    if (highestScore < 0.25) {
      return "LOW_CONFIDENCE_EVIDENCE: The retrieved documents have low relevance to the question. Do not speculate. Offer to connect the customer with a human support agent.";
    }

    const formattedEvidenceText = evidenceItems
      .map(
        (e) =>
          `[Evidence ${e.evidenceId}] (Source: "${e.sourceDoc}"${e.section ? `, Section: "${e.section}"` : ""}, Type: ${e.contentType}):\n${e.text}`
      )
      .join("\n\n---\n\n");

    const finalResultText = `Retrieved Knowledge Base Evidence:\n\n${formattedEvidenceText}\n\nInstructions: Answer the user's question directly and concisely strictly using the evidence above. Preserve exact figures, units, and conditions. Cite the source document in your answer (e.g. "[Source: ${evidenceItems[0]?.sourceDoc || "Knowledge Base"}]"). If the evidence does not contain the answer, say you do not have that specific information and offer escalation.`;

    // 4. Cache structured evidence
    MultiTenantRetrievalCache.set(orgId, normalized || args.query, finalResultText, contextTitles);

    logAIOperation({
      event: "rag.search",
      organizationId: orgId,
      conversationId: conversation._id,
      threadId: ctx.threadId,
      latencyMs: Date.now() - startTime,
      details: {
        cacheHit: false,
        intent,
        retrievedCount: searchResult.entries.length,
        rerankedCount: reranked.entries.length,
        evidenceTypes: evidenceItems.map((e) => e.contentType),
      },
    });

    return finalResultText;
  },
});
