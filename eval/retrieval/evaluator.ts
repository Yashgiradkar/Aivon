/**
 * RAG Retrieval Metrics Evaluator
 * Calculates Precision@K, Recall@K, MRR (Mean Reciprocal Rank), and Hit Rate
 */

export interface RetrievalEvalItem {
  retrievedDocIds: string[];
  relevantDocIds: string[];
}

export interface RetrievalMetrics {
  precisionAtK: number;
  recallAtK: number;
  mrr: number;
  hitRate: number;
}

export function evaluateRetrieval(items: RetrievalEvalItem[], k: number = 3): RetrievalMetrics {
  if (items.length === 0) {
    return { precisionAtK: 0, recallAtK: 0, mrr: 0, hitRate: 0 };
  }

  let totalPrecision = 0;
  let totalRecall = 0;
  let totalReciprocalRank = 0;
  let totalHits = 0;

  for (const item of items) {
    const topK = item.retrievedDocIds.slice(0, k);
    const relevantSet = new Set(item.relevantDocIds);

    const hitCount = topK.filter((id) => relevantSet.has(id)).length;
    const precision = topK.length > 0 ? hitCount / topK.length : 0;
    const recall = item.relevantDocIds.length > 0 ? hitCount / item.relevantDocIds.length : 0;

    totalPrecision += precision;
    totalRecall += recall;

    if (hitCount > 0) {
      totalHits++;
    }

    // Reciprocal Rank: index of first relevant item in retrieved list (1-indexed)
    let firstRank = 0;
    for (let i = 0; i < topK.length; i++) {
      if (topK[i] && relevantSet.has(topK[i])) {
        firstRank = i + 1;
        break;
      }
    }
    if (firstRank > 0) {
      totalReciprocalRank += 1 / firstRank;
    }
  }

  const n = items.length;
  return {
    precisionAtK: Number((totalPrecision / n).toFixed(4)),
    recallAtK: Number((totalRecall / n).toFixed(4)),
    mrr: Number((totalReciprocalRank / n).toFixed(4)),
    hitRate: Number((totalHits / n).toFixed(4)),
  };
}
