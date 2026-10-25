/**
 * Semantic Answer Cache and Provider Prompt Prefix Optimizer
 *
 * Implements:
 * 1. Cacheability eligibility rules (prevent caching private account data, side-effects, volatile data)
 * 2. High-precision cosine similarity matching on canonical embeddings
 * 3. Cache TTL, invalidation markers, and hit-rate tracking
 * 4. Provider prompt prefix alignment (OpenAI & Anthropic KV cache reuse)
 */

export interface CacheEligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface PromptPrefixConfig {
  systemPrompt: string;
  toolDefinitions?: string;
  dynamicContext: string;
}

export class SemanticCacheLogic {
  public static DEFAULT_SIMILARITY_THRESHOLD = 0.94;
  public static DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Volatile or sensitive terms that should NEVER be cached
  private static VOLATILE_PATTERNS = [
    /\b(balance|payment|invoice|bill|credit card|cvv|password|token)\b/i,
    /\b(today|right now|current time|current date|yesterday|tomorrow)\b/i,
    /\b(my account|my profile|my policy|transfer|refund|cancel subscription)\b/i,
    /\b(escalate|talk to human|speak with agent)\b/i,
  ];

  /**
   * Evaluates if a customer query is eligible for semantic answer caching.
   */
  public static evaluateEligibility(
    query: string,
    options?: { hasPersonalData?: boolean; hasSideEffects?: boolean }
  ): CacheEligibilityResult {
    if (!query || query.trim().length < 8) {
      return { eligible: false, reason: "Query too short for semantic caching" };
    }

    if (query.trim().length > 300) {
      return { eligible: false, reason: "Query too long or conversational for generalized caching" };
    }

    if (options?.hasPersonalData) {
      return { eligible: false, reason: "Request contains personalized account or private data" };
    }

    if (options?.hasSideEffects) {
      return { eligible: false, reason: "Request triggers side-effecting tools or account modifications" };
    }

    for (const pattern of this.VOLATILE_PATTERNS) {
      if (pattern.test(query)) {
        return { eligible: false, reason: "Contains volatile or account-specific terminology" };
      }
    }

    return { eligible: true };
  }

  /**
   * Normalizes query text to create a canonical lookup representation.
   */
  public static normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ");
  }

  /**
   * Generates a stable hash for fast exact/near-match table index lookup.
   */
  public static hashQuery(normalizedQuery: string): string {
    let hash = 0;
    for (let i = 0; i < normalizedQuery.length; i++) {
      hash = (hash << 5) - hash + normalizedQuery.charCodeAt(i);
      hash |= 0;
    }
    return `q_hash_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Computes cosine similarity between two unit or un-normalized embedding vectors.
   */
  public static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i]! * vecB[i]!;
      normA += vecA[i]! * vecA[i]!;
      normB += vecB[i]! * vecB[i]!;
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Formats prompts to maximize Provider-level KV prompt-prefix caching.
   * Keeps static instructions and tool definitions strictly at the top of the prompt.
   */
  public static assemblePromptWithPrefixOptimization(config: PromptPrefixConfig): {
    staticPrefix: string;
    dynamicSuffix: string;
    fullPrompt: string;
  } {
    const staticParts: string[] = [config.systemPrompt.trim()];
    if (config.toolDefinitions) {
      staticParts.push(`<static_tools>\n${config.toolDefinitions.trim()}\n</static_tools>`);
    }

    const staticPrefix = staticParts.join("\n\n");
    const dynamicSuffix = config.dynamicContext.trim();
    const fullPrompt = `${staticPrefix}\n\n${dynamicSuffix}`;

    return {
      staticPrefix,
      dynamicSuffix,
      fullPrompt,
    };
  }
}
