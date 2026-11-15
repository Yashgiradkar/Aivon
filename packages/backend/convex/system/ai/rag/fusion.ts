/**
 * Reciprocal Rank Fusion (RRF) & Hybrid Candidate Deduplication
 * Mathematical formulation: RRF(d) = Σ_r [ w_r / (k + rank_r(d)) ]
 */

export interface CandidateItem {
  id: string;
  entryId: string;
  title: string;
  text: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface FusedCandidate extends CandidateItem {
  rrfScore: number;
  denseRank?: number;
  bm25Rank?: number;
}

export interface RRFOptions {
  k?: number;        // Smoothing constant (standard default = 60)
  denseWeight?: number;
  bm25Weight?: number;
}

/**
 * Standard Reciprocal Rank Fusion (RRF)
 * Fuses ordered candidate lists from multiple heterogeneous retrieval systems.
 */
export function reciprocalRankFusion(
  denseRankings: CandidateItem[],
  bm25Rankings: CandidateItem[],
  options: RRFOptions = {}
): FusedCandidate[] {
  const k = options.k ?? 60;
  const denseWeight = options.denseWeight ?? 1.0;
  const bm25Weight = options.bm25Weight ?? 1.0;

  const itemMap = new Map<string, CandidateItem>();
  const denseRanks = new Map<string, number>();
  const bm25Ranks = new Map<string, number>();
  const rrfScores = new Map<string, number>();

  // Process dense vector rankings (1-indexed)
  for (let rank = 1; rank <= denseRankings.length; rank++) {
    const item = denseRankings[rank - 1];
    if (!item) continue;
    itemMap.set(item.id, item);
    denseRanks.set(item.id, rank);
    const scoreComponent = denseWeight / (k + rank);
    rrfScores.set(item.id, (rrfScores.get(item.id) ?? 0) + scoreComponent);
  }

  // Process BM25 rankings (1-indexed)
  for (let rank = 1; rank <= bm25Rankings.length; rank++) {
    const item = bm25Rankings[rank - 1];
    if (!item) continue;
    if (!itemMap.has(item.id)) {
      itemMap.set(item.id, item);
    }
    bm25Ranks.set(item.id, rank);
    const scoreComponent = bm25Weight / (k + rank);
    rrfScores.set(item.id, (rrfScores.get(item.id) ?? 0) + scoreComponent);
  }

  // Build sorted fused candidate list
  const fused: FusedCandidate[] = Array.from(rrfScores.entries())
    .map(([id, rrfScore]) => {
      const item = itemMap.get(id)!;
      return {
        ...item,
        rrfScore,
        denseRank: denseRanks.get(id),
        bm25Rank: bm25Ranks.get(id),
      };
    })
    .sort((a, b) => b.rrfScore - a.rrfScore);

  return fused;
}

/**
 * Normalizes dense vector entries and BM25 results into uniform candidates,
 * then fuses them via Reciprocal Rank Fusion (RRF).
 *
 * Both lists are keyed by `entryId` so that multiple BM25 chunks from the same
 * document and the corresponding dense result all merge before fusion. Without
 * this normalization the ID spaces are disjoint and RRF never deduplicates.
 */
export function normalizeCandidates(
  vectorEntries: Array<{ title?: string; text?: string; score?: number; entryId?: string; [key: string]: unknown }>,
  bm25Results: Array<{ id: string; entryId: string; title: string; text: string; score: number }>,
  options: RRFOptions = {}
): FusedCandidate[] {
  // Use entryId as the canonical ID so dense and BM25 results for the same
  // document collapse to one candidate before RRF scoring.
  const denseCandidates: CandidateItem[] = vectorEntries.map((e) => ({
    id: (e.entryId as string) || `dense_no_entry_${Math.random()}`,
    entryId: (e.entryId as string) || "",
    title: (e.title as string) || "Knowledge Document",
    text: (e.text as string) || "",
    score: e.score,
  }));

  // For BM25, multiple chunks may share the same entryId. Deduplicate by
  // entryId, keeping the chunk with the highest BM25 score as the representative.
  const bm25ByEntry = new Map<string, CandidateItem & { score: number }>();
  for (const b of bm25Results) {
    const existing = bm25ByEntry.get(b.entryId);
    if (!existing || b.score > existing.score) {
      bm25ByEntry.set(b.entryId, {
        id: b.entryId,
        entryId: b.entryId,
        title: b.title,
        text: b.text,
        score: b.score,
      });
    }
  }
  const bm25Candidates: CandidateItem[] = Array.from(bm25ByEntry.values());

  return reciprocalRankFusion(denseCandidates, bm25Candidates, options);
}

