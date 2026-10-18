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
 * Normalizes dense vector entries and BM25 results into uniform candidates
 */
export function normalizeCandidates(
  vectorEntries: Array<{ title?: string; text?: string; score?: number; entryId?: string; [key: string]: unknown }>,
  bm25Results: Array<{ id: string; entryId: string; title: string; text: string; score: number }>,
  options: RRFOptions = {}
): FusedCandidate[] {
  const denseCandidates: CandidateItem[] = vectorEntries.map((e, idx) => ({
    id: (e.entryId as string) ? `${e.entryId}:${idx}` : `dense_${idx}_${(e.title || "").slice(0, 20)}`,
    entryId: (e.entryId as string) || `entry_${idx}`,
    title: (e.title as string) || "Knowledge Document",
    text: (e.text as string) || "",
    score: e.score,
  }));

  const bm25Candidates: CandidateItem[] = bm25Results.map((b) => ({
    id: b.id,
    entryId: b.entryId,
    title: b.title,
    text: b.text,
    score: b.score,
  }));

  return reciprocalRankFusion(denseCandidates, bm25Candidates, options);
}
