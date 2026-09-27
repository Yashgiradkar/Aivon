export interface RAGDocumentEntry {
  title?: string;
  text?: string;
  score?: number;
  [key: string]: unknown;
}

export interface RerankResult {
  entries: RAGDocumentEntry[];
  reranked: boolean;
  strategy: "cohere" | "heuristic" | "passthrough";
}

/**
 * Pluggable Reranking Engine with Graceful Fallback
 *
 * Re-scores candidate retrieval results based on query relevance.
 * If reranking fails or times out, falls back to original vector ranking.
 */
export async function rerankSearchResults(
  query: string,
  entries: RAGDocumentEntry[],
  topK: number = 3
): Promise<RerankResult> {
  if (!entries || entries.length === 0) {
    return { entries: [], reranked: false, strategy: "passthrough" };
  }

  try {
    // Lightweight keyword-overlap / term-frequency heuristic reranker for candidate refinement
    const queryTerms = new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2)
    );

    const scored = entries.map((entry) => {
      const content = `${entry.title || ""} ${entry.text || ""}`.toLowerCase();
      let matchCount = 0;
      for (const term of queryTerms) {
        if (content.includes(term)) {
          matchCount++;
        }
      }

      const originalScore = entry.score ?? 0.5;
      const boost = queryTerms.size > 0 ? (matchCount / queryTerms.size) * 0.3 : 0;

      return {
        ...entry,
        combinedScore: originalScore + boost,
      };
    });

    scored.sort((a, b) => b.combinedScore - a.combinedScore);

    return {
      entries: scored.slice(0, topK),
      reranked: true,
      strategy: "heuristic",
    };
  } catch {
    // Safe graceful degradation: return original vector results without crashing
    return {
      entries: entries.slice(0, topK),
      reranked: false,
      strategy: "passthrough",
    };
  }
}
