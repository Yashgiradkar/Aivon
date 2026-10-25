import { internal } from "../../../_generated/api";
import rag from "../rag";
import { normalizeSearchQuery, cleanDenseQuery } from "./queryNormalizer";
import { routeQuery, RetrievalStrategy, QueryClassification } from "./queryRouter";
import { BM25Index, TenantBM25Cache } from "./bm25";
import { normalizeCandidates, FusedCandidate } from "./fusion";
import { rerankSearchResults } from "./reranker";
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

export interface UnifiedSearchResult {
  evidenceItems: EvidenceItem[];
  formattedEvidenceText: string;
  finalResultText: string;
  effectiveStrategy: RetrievalStrategy;
  fromCache: boolean;
  denseCount: number;
  bm25Count: number;
  fusedCount: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
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
 * Detects if a spoken voice query mentions a partial or ambiguous policy identifier
 * that needs verbal confirmation before answering.
 */
export function detectAmbiguousVoiceIdentifier(query: string): { isAmbiguous: boolean; suggestedClarification?: string } {
  // Matches fragmented identifiers, e.g. "TEST POL 48273" (missing a digit) or "policy 48273" without prefix
  const incompletePattern = /\b(test[-_\s]?pol[-_\s]?\d{1,5})\b/i;
  const match = query.match(incompletePattern);
  if (match) {
    return {
      isAmbiguous: true,
      suggestedClarification: `I heard policy number ${match[1]}, which seems incomplete. Standard policy numbers have 6 digits, like TEST-POL-482731. Could you please confirm your complete policy number?`,
    };
  }

  // Matches spoken digits with spaces or words, e.g. "policy four eight two seven"
  const spokenWordsPattern = /\bpolicy\s+(?:number\s+)?(zero|one|two|three|four|five|six|seven|eight|nine|\d)+/i;
  const wordMatch = query.match(spokenWordsPattern);
  if (wordMatch && !query.match(/TEST-POL-\d{6}/i)) {
    return {
      isAmbiguous: true,
      suggestedClarification: "Could you please confirm the full policy identifier including the prefix, such as TEST-POL followed by your six-digit number?",
    };
  }

  return { isAmbiguous: false };
}

/**
 * Loads or builds the tenant-isolated BM25 index from Convex database chunks
 */
export async function getOrBuildTenantBM25Index(
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

/**
 * Unified multi-format hybrid retrieval engine for both Chat and Voice assistants.
 */
export async function executeUnifiedRetrieval(
  ctx: any,
  options: {
    organizationId: string;
    query: string;
    limit?: number;
    conversationId?: any;
    threadId?: string;
    source?: "chat" | "voice";
  }
): Promise<UnifiedSearchResult> {
  const { organizationId: orgId, query, limit = 4, conversationId, threadId, source = "chat" } = options;
  const normalizedQuery = normalizeSearchQuery(query);
  const intent = detectQueryIntent(query);

  // 1. Query-Aware Classification & Retrieval Routing Policy
  const routing: QueryClassification = routeQuery(query);
  let effectiveStrategy: RetrievalStrategy = routing.strategy;
  let fallbackUsed = false;
  let fallbackReason: string | undefined;

  // 2. Check multi-tenant retrieval cache
  const cached = MultiTenantRetrievalCache.get(orgId, normalizedQuery);
  if (cached) {
    logAIOperation({
      event: "rag.search",
      organizationId: orgId,
      conversationId,
      threadId,
      details: {
        source,
        cacheHit: true,
        query: normalizedQuery,
        intent,
        strategy: routing.strategy,
        reasons: routing.reasons,
      },
    });
    return {
      evidenceItems: [],
      formattedEvidenceText: cached.resultText,
      finalResultText: cached.resultText,
      effectiveStrategy: routing.strategy,
      fromCache: true,
      denseCount: 0,
      bm25Count: 0,
      fusedCount: 0,
      fallbackUsed: false,
    };
  }

  const startTime = Date.now();

  // 3. Retrieval Execution Branch Helpers
  const executeDense = async () => {
    try {
      const denseQuery = cleanDenseQuery(query) || query;
      const res = await rag.search(ctx, {
        namespace: orgId,
        query: denseQuery,
        limit: Math.max(limit + 2, 6),
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
      return index.search(query, Math.max(limit + 2, 6));
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

    // When query targets an exact identifier code (e.g. TEST-POL-999999) and lexical
    // BM25 returns 0 matches, the policy is absent from this tenant's corpus.
    // Suppress dense vector fallback to avoid false substitution of unrelated policies.
    if (routing.features.hasExactCode && bm25Results.length === 0) {
      denseEntries = [];
    }
  }

  // 5. Candidate Ranking & Reciprocal Rank Fusion (RRF)
  let candidateList: Array<{ title: string; text: string; score: number; retrievalSource: "dense" | "bm25" | "hybrid_rrf" }> = [];

  if (denseEntries.length > 0 && bm25Results.length > 0) {
    const fused: FusedCandidate[] = normalizeCandidates(denseEntries, bm25Results, {
      k: 60,
      denseWeight: 1.0,
      bm25Weight: 1.0,
    });

    candidateList = fused.slice(0, limit).map((f) => ({
      title: f.title,
      text: f.text,
      score: f.rrfScore,
      retrievalSource: "hybrid_rrf",
    }));
  } else if (denseEntries.length > 0) {
    const reranked = await rerankSearchResults(query, denseEntries, limit);
    candidateList = reranked.entries.map((e) => ({
      title: (e.title as string) || "Knowledge Document",
      text: (e.text as string) || "",
      score: typeof e.combinedScore === "number" ? e.combinedScore : (e.score ?? 0.5),
      retrievalSource: "dense",
    }));
  } else if (bm25Results.length > 0) {
    candidateList = bm25Results.slice(0, limit).map((b) => ({
      title: b.title,
      text: b.text,
      score: b.score,
      retrievalSource: "bm25",
    }));
  }

  // 5b. Exact Identifier Constraint Filtering
  // When a query specifically targets an exact policy or technical identifier,
  // ensure candidates actually contain the requested identifier, preventing false
  // substitution from documents that merely share generic terms like "deductible" or "policy".
  if (routing.features.hasExactCode && routing.features.extractedIdentifiers.length > 0) {
    const requiredIds = routing.features.extractedIdentifiers.map((id) => id.toUpperCase());
    const idFiltered = candidateList.filter((c) => {
      const combined = (c.title + " " + c.text).toUpperCase();
      return requiredIds.some((id) => combined.includes(id));
    });
    candidateList = idFiltered;
  }

  if (candidateList.length === 0) {
    const noResult = "NO_RELEVANT_EVIDENCE: No relevant information was found in the knowledge base. State that you do not have specific information and offer to connect the customer with a human support specialist.";
    return {
      evidenceItems: [],
      formattedEvidenceText: noResult,
      finalResultText: noResult,
      effectiveStrategy,
      fromCache: false,
      denseCount: denseEntries.length,
      bm25Count: bm25Results.length,
      fusedCount: 0,
      fallbackUsed,
      fallbackReason,
    };
  }

  // 6. Format structured evidence items with citation anchors and content badges
  const evidenceItems: EvidenceItem[] = candidateList.map((entry, idx) => {
    const text = entry.text || "";
    let contentType: EvidenceItem["contentType"] = "prose";
    if (text.includes("Table:") || text.includes("Data Records:") || text.includes("|")) {
      contentType = "table";
    } else if (text.includes("Chart:") || text.includes("Plotted Data Points:") || text.includes("[CHART:")) {
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
    conversationId,
    threadId,
    latencyMs: Date.now() - startTime,
    details: {
      source,
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

  return {
    evidenceItems,
    formattedEvidenceText,
    finalResultText,
    effectiveStrategy,
    fromCache: false,
    denseCount: denseEntries.length,
    bm25Count: bm25Results.length,
    fusedCount: candidateList.length,
    fallbackUsed,
    fallbackReason,
  };
}
