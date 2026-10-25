/**
 * Okapi BM25 Lexical Retrieval Engine
 * Production-ready BM25 scoring with IDF calculation, term frequency saturation (k1),
 * document length normalization (b), and multi-tenant isolation.
 */

export interface BM25Document {
  id: string;
  entryId: string;
  title: string;
  text: string;
  tokens: string[];
  length: number;
}

export interface BM25SearchResult {
  id: string;
  entryId: string;
  title: string;
  text: string;
  score: number;
}

export interface BM25Options {
  k1?: number; // Term frequency saturation (default 1.2)
  b?: number;  // Document length normalization (default 0.75)
}

/**
 * Technical-aware tokenizer
 * Preserves exact codes, error tokens (WC-104, ERR_404), and hyphenated terms.
 */
export function tokenizeBM25(text: string): string[] {
  if (!text) return [];

  // Match words, hyphenated technical terms, dot/underscore identifiers
  const matches = text
    .toLowerCase()
    .match(/[a-z0-9]+(?:[-_.:/][a-z0-9]+)*/g);

  return matches ? matches.filter((t) => t.length > 0) : [];
}

export class BM25Index {
  private documents: Map<string, BM25Document> = new Map();
  private invertedIndex: Map<string, Map<string, number>> = new Map(); // term -> docId -> frequency
  private docLengths: Map<string, number> = new Map();
  private totalLength = 0;
  private k1: number;
  private b: number;

  constructor(options: BM25Options = {}) {
    this.k1 = options.k1 ?? 1.2;
    this.b = options.b ?? 0.75;
  }

  public addDocument(doc: { id: string; entryId: string; title: string; text: string }): void {
    const tokens = tokenizeBM25(`${doc.title} ${doc.text}`);
    const length = tokens.length;

    // Remove existing if replacing
    if (this.documents.has(doc.id)) {
      this.removeDocument(doc.id);
    }

    const bm25Doc: BM25Document = {
      id: doc.id,
      entryId: doc.entryId,
      title: doc.title,
      text: doc.text,
      tokens,
      length,
    };

    this.documents.set(doc.id, bm25Doc);
    this.docLengths.set(doc.id, length);
    this.totalLength += length;

    // Index term frequencies
    const termFreqs = new Map<string, number>();
    for (const token of tokens) {
      termFreqs.set(token, (termFreqs.get(token) ?? 0) + 1);
    }

    for (const [term, freq] of termFreqs.entries()) {
      let postingList = this.invertedIndex.get(term);
      if (!postingList) {
        postingList = new Map();
        this.invertedIndex.set(term, postingList);
      }
      postingList.set(doc.id, freq);
    }
  }

  public removeDocument(docId: string): void {
    const doc = this.documents.get(docId);
    if (!doc) return;

    this.totalLength -= doc.length;
    this.docLengths.delete(docId);
    this.documents.delete(docId);

    // Clean inverted index
    for (const token of doc.tokens) {
      const postingList = this.invertedIndex.get(token);
      if (postingList) {
        postingList.delete(docId);
        if (postingList.size === 0) {
          this.invertedIndex.delete(token);
        }
      }
    }
  }

  public get size(): number {
    return this.documents.size;
  }

  /**
   * Calculate Robertson-Sparck Jones IDF with additive smoothing:
   * IDF(t) = ln( (N - n(t) + 0.5) / (n(t) + 0.5) + 1 )
   */
  public calculateIDF(term: string): number {
    const N = this.documents.size;
    if (N === 0) return 0;

    const postingList = this.invertedIndex.get(term);
    const n = postingList ? postingList.size : 0;
    if (n === 0) return 0;

    return Math.log(((N - n + 0.5) / (n + 0.5)) + 1.0);
  }

  /**
   * Execute BM25 search over the indexed corpus
   */
  public search(query: string, topK: number = 6): BM25SearchResult[] {
    const queryTokens = tokenizeBM25(query);
    if (queryTokens.length === 0 || this.documents.size === 0) {
      return [];
    }

    const N = this.documents.size;
    const avgdl = this.totalLength / (N || 1);
    const candidateScores = new Map<string, number>();

    // Exact phrase detection
    const exactPhraseMatch = query.match(/"([^"]+)"|'([^']+)'/);
    const quotedPhrase = (exactPhraseMatch?.[1] || exactPhraseMatch?.[2] || "").toLowerCase().trim();

    // Score documents
    for (const token of queryTokens) {
      const postingList = this.invertedIndex.get(token);
      if (!postingList) continue;

      const idf = this.calculateIDF(token);
      if (idf <= 0) continue;

      for (const [docId, freq] of postingList.entries()) {
        const docLen = this.docLengths.get(docId) ?? avgdl;
        
        // Okapi BM25 term score component
        const numerator = freq * (this.k1 + 1);
        const denominator = freq + this.k1 * (1 - this.b + this.b * (docLen / (avgdl || 1)));
        const termScore = idf * (numerator / denominator);

        candidateScores.set(docId, (candidateScores.get(docId) ?? 0) + termScore);
      }
    }

    // Exact phrase & exact identifier boost
    if (candidateScores.size > 0) {
      for (const [docId, score] of candidateScores.entries()) {
        const doc = this.documents.get(docId);
        if (!doc) continue;

        let boost = 0;
        const lowerText = `${doc.title} ${doc.text}`.toLowerCase();

        // Exact quoted phrase match boost
        if (quotedPhrase && lowerText.includes(quotedPhrase)) {
          boost += 3.0;
        }

        // Exact code token match boost
        for (const token of queryTokens) {
          if (token.includes("-") || token.includes("_") || /\d/.test(token)) {
            if (lowerText.includes(token)) {
              boost += 1.5;
            }
          }
        }

        if (boost > 0) {
          candidateScores.set(docId, score + boost);
        }
      }
    }

    // Sort descending by BM25 score
    const results: BM25SearchResult[] = Array.from(candidateScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([docId, score]) => {
        const doc = this.documents.get(docId)!;
        return {
          id: doc.id,
          entryId: doc.entryId,
          title: doc.title,
          text: doc.text,
          score,
        };
      });

    return results;
  }
}

/**
 * Tenant-Isolated In-Memory BM25 Cache
 *
 * Caches a built BM25 index per organizationId within the current process.
 *
 * IMPORTANT — Serverless behaviour: Convex actions run as serverless functions.
 * Each cold invocation starts with an empty module-level Map, so this cache
 * provides no benefit across independent invocations. When the same container
 * is reused for a second request (warm start), the cache saves the O(n) index
 * rebuild. The 30-minute TTL guards against stale data on warm containers but
 * is not the primary latency concern. Accept the rebuild cost at current
 * scale; revisit if p95 search latency exceeds the agreed SLA.
 */
export class TenantBM25Cache {
  private static indices = new Map<string, { index: BM25Index; timestamp: number }>();
  private static readonly TTL_MS = 30 * 60 * 1000; // 30 minutes

  public static get(orgId: string): BM25Index | null {
    const entry = this.indices.get(orgId);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.indices.delete(orgId);
      return null;
    }
    return entry.index;
  }

  public static set(orgId: string, index: BM25Index): void {
    this.indices.set(orgId, { index, timestamp: Date.now() });
  }

  public static invalidate(orgId: string): void {
    this.indices.delete(orgId);
  }

  public static clear(): void {
    this.indices.clear();
  }
}
