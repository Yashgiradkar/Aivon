import { createTool } from "@convex-dev/agent";
import z from "zod";
import { internal } from "../../../_generated/api";
import rag from "../rag";
import { normalizeSearchQuery, cleanDenseQuery } from "../rag/queryNormalizer";
import { routeQuery, RetrievalStrategy, QueryClassification } from "../rag/queryRouter";
import { BM25Index, TenantBM25Cache } from "../rag/bm25";
import { normalizeCandidates, FusedCandidate } from "../rag/fusion";
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
  retrievalSource?: "dense" | "bm25" | "hybrid_rrf";
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

/**
 * Loads or builds the tenant-isolated BM25 index from Convex database chunks
 */
async function getOrBuildTenantBM25Index(
  ctx: { runQuery: any },
  orgId: string
): Promise<BM25Index> {
  const cached = TenantBM25Cache.get(orgId);
  if (cached) return cached;

  const index = new BM25Index({ k1: 1.2, b: 0.75 });
  try {
    const chunks = await ctx.runQuery(internal.system.ai.rag.corpus.getTenantCorpus, {
      organizationId: orgId,
    });
    for (const chunk of chunks) {
      index.addDocument({
        id: chunk.id,
        entryId: chunk.entryId,
        title: chunk.title,
        text: chunk.text,
      });
    }
    TenantBM25Cache.set(orgId, index);
  } catch (err) {
    console.error("[BM25] Failed to build tenant index:", err);
  }
  return index;
}

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

    const orgId = conversation.organizationId;
    const normalizedQuery = normalizeSearchQuery(args.query);
    const intent = detectQueryIntent(args.query);

    // 1. Query-Aware Classification & Retrieval Routing Policy
    const routing: QueryClassification = routeQuery(args.query);
    let effectiveStrategy: RetrievalStrategy = routing.strategy;
    let fallbackUsed = false;
    let fallbackReason: string | undefined;

    // 2. Check multi-tenant retrieval cache
    const cached = MultiTenantRetrievalCache.get(orgId, normalizedQuery);
    if (cached) {
      logAIOperation({
        event: "rag.search",
        organizationId: orgId,
        conversationId: conversation._id,
        threadId: ctx.threadId,
        details: {
          cacheHit: true,
          query: normalizedQuery,
          intent,
          strategy: routing.strategy,
          reasons: routing.reasons,
        },
      });
      return cached.resultText;
    }

    const startTime = Date.now();

    // 3. Retrieval Execution Branch Helpers
    const executeDense = async () => {
      try {
        const denseQuery = cleanDenseQuery(args.query) || args.query;
        const res = await rag.search(ctx, {
          namespace: orgId,
          query: denseQuery,
          limit: 6,
        });
        return res.entries || [];
      } catch (err) {
        console.error("[DenseSearch] Vector search failed:", err);
        return [];
      }
    };

    const executeBM25 = async () => {
      try {
        const index = await getOrBuildTenantBM25Index(ctx, orgId);
        return index.search(args.query, 6);
      } catch (err) {
        console.error("[BM25Search] Lexical search failed:", err);
        return [];
      }
    };

    let denseEntries: Array<{ title?: string; text?: string; score?: number; entryId?: string }> = [];
    let bm25Results: Array<{ id: string; entryId: string; title: string; text: string; score: number }> = [];

    // 4. Execute Selected Strategy with Degraded-Mode Recovery
    if (routing.strategy === "dense") {
      denseEntries = await executeDense();
      if (denseEntries.length === 0) {
        // Degraded mode: fallback to BM25
        bm25Results = await executeBM25();
        if (bm25Results.length > 0) {
          fallbackUsed = true;
          fallbackReason = "Dense vector search returned 0 results; degraded to BM25";
          effectiveStrategy = "bm25";
        }
      }
    } else if (routing.strategy === "bm25") {
      bm25Results = await executeBM25();
      if (bm25Results.length === 0) {
        // Degraded mode: fallback to Dense vector search
        denseEntries = await executeDense();
        if (denseEntries.length > 0) {
          fallbackUsed = true;
          fallbackReason = "BM25 search returned 0 results; degraded to Dense vector";
          effectiveStrategy = "dense";
        }
      }
    } else {
      // Hybrid strategy: execute dense and BM25 concurrently
      const [denseOutcome, bm25Outcome] = await Promise.allSettled([
        executeDense(),
        executeBM25(),
      ]);

      denseEntries = denseOutcome.status === "fulfilled" ? denseOutcome.value : [];
      bm25Results = bm25Outcome.status === "fulfilled" ? bm25Outcome.value : [];

      if (denseOutcome.status === "rejected" && bm25Results.length > 0) {
        fallbackUsed = true;
        fallbackReason = "Dense vector search failed; degraded to BM25 only";
      } else if (bm25Outcome.status === "rejected" && denseEntries.length > 0) {
        fallbackUsed = true;
        fallbackReason = "BM25 search failed; degraded to Dense vector only";
      }
    }

    // 5. Candidate Ranking & Reciprocal Rank Fusion (RRF)
    let candidateList: Array<{ title: string; text: string; score: number; retrievalSource: "dense" | "bm25" | "hybrid_rrf" }> = [];

    if (denseEntries.length > 0 && bm25Results.length > 0) {
      // True mathematical Reciprocal Rank Fusion
      const fused: FusedCandidate[] = normalizeCandidates(denseEntries, bm25Results, {
        k: 60,
        denseWeight: 1.0,
        bm25Weight: 1.0,
      });

      candidateList = fused.slice(0, 4).map((f) => ({
        title: f.title,
        text: f.text,
        score: f.rrfScore,
        retrievalSource: "hybrid_rrf",
      }));
    } else if (denseEntries.length > 0) {
      const reranked = await rerankSearchResults(args.query, denseEntries, 4);
      candidateList = reranked.entries.map((e) => ({
        title: (e.title as string) || "Knowledge Document",
        text: (e.text as string) || "",
        score: typeof e.combinedScore === "number" ? e.combinedScore : (e.score ?? 0.5),
        retrievalSource: "dense",
      }));
    } else if (bm25Results.length > 0) {
      candidateList = bm25Results.slice(0, 4).map((b) => ({
        title: b.title,
        text: b.text,
        score: b.score,
        retrievalSource: "bm25",
      }));
    }

    if (candidateList.length === 0) {
      return "NO_RELEVANT_EVIDENCE: No relevant information was found in the knowledge base. State that you do not have specific information and offer to connect the customer with a human support specialist.";
    }

    // 6. Format structured evidence items with citation anchors and content badges
    const evidenceItems: EvidenceItem[] = candidateList.map((entry, idx) => {
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
        sourceDoc: entry.title || "Knowledge Document",
        contentType,
        section,
        score: entry.score,
        text,
        retrievalSource: entry.retrievalSource,
      };
    });

    const contextTitles = evidenceItems.map((e) => e.sourceDoc);

    const formattedEvidenceText = evidenceItems
      .map(
        (e) =>
          `[Evidence ${e.evidenceId}] (Source: "${e.sourceDoc}"${e.section ? `, Section: "${e.section}"` : ""}, Type: ${e.contentType}, Retrieval: ${e.retrievalSource}):\n${e.text}`
      )
      .join("\n\n---\n\n");

    const finalResultText = `Retrieved Knowledge Base Evidence:\n\n${formattedEvidenceText}\n\nInstructions: Answer the user's question directly and concisely strictly using the evidence above. Preserve exact figures, units, and conditions. Cite the source document in your answer (e.g. "[Source: ${evidenceItems[0]?.sourceDoc || "Knowledge Base"}]"). If the evidence does not contain the answer, say you do not have that specific information and offer escalation.`;

    // 7. Multi-tenant caching
    MultiTenantRetrievalCache.set(orgId, normalizedQuery, finalResultText, contextTitles);

    logAIOperation({
      event: "rag.search",
      organizationId: orgId,
      conversationId: conversation._id,
      threadId: ctx.threadId,
      latencyMs: Date.now() - startTime,
      details: {
        cacheHit: false,
        intent,
        requestedStrategy: routing.strategy,
        effectiveStrategy,
        routingConfidence: routing.confidence,
        routingReasons: routing.reasons,
        fallbackUsed,
        fallbackReason,
        denseCount: denseEntries.length,
        bm25Count: bm25Results.length,
        fusedCount: candidateList.length,
        evidenceTypes: evidenceItems.map((e) => e.contentType),
      },
    });

    return finalResultText;
  },
});
