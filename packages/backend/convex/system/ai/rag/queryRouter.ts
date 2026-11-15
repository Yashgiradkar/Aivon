/**
 * Query Classifier & Retrieval Routing Engine
 * Deterministic, explainable, testable policy for selecting dense, BM25, or hybrid retrieval.
 */

export type RetrievalStrategy = "dense" | "bm25" | "hybrid";

export interface QueryFeatures {
  hasExactCode: boolean;
  hasQuotedPhrase: boolean;
  hasTechnicalIdentifier: boolean;
  isSemanticQuestion: boolean;
  tokenCount: number;
  extractedIdentifiers: string[];
}

export interface QueryClassification {
  strategy: RetrievalStrategy;
  confidence: number;
  reasons: string[];
  features: QueryFeatures;
}

// Regex patterns for identifiers, error codes, and technical symbols.
// Greedily matches multi-segment identifiers (e.g. TEST-POL-482731, ERR-404, SKU-ABC-001)
// so that all segments are captured as a single unit rather than being split.
const EXACT_CODE_PATTERN = /\b([A-Z0-9]{2,}(?:[-_:][A-Z0-9]+)+|(?:ERR|ERROR|CODE|TICKET|SKU|REF|ID|ISO|SEC|V|API)[-_:]?\d+)\b/gi;
const TECHNICAL_IDENTIFIER_PATTERN = /\b[a-zA-Z_][a-zA-Z0-9_]*[._/][a-zA-Z0-9_./]+\b|\b[a-z]+[A-Z][a-zA-Z0-9]+\b|\b[a-z]+_[a-z0-9_]+\b/g;
const QUOTED_PHRASE_PATTERN = /"([^"]+)"|'([^']+)'/g;
const SEMANTIC_INTERROGATIVE_PATTERN = /^(how|why|what|explain|describe|tell me|can i|is there|guide me|steps to|ways to|when should|help me with)\b/i;

export function extractQueryFeatures(rawQuery: string): QueryFeatures {
  const query = rawQuery.trim();
  const words = query.split(/\s+/).filter(Boolean);

  // 1. Quoted phrases
  const quotedMatches = Array.from(query.matchAll(QUOTED_PHRASE_PATTERN));
  const hasQuotedPhrase = quotedMatches.some((m) => (m[1] || m[2] || "").trim().length > 1);

  // 2. Exact identifiers and error codes
  const codeMatches = Array.from(query.matchAll(EXACT_CODE_PATTERN)).map((m) => m[0]);
  const hasExactCode = codeMatches.length > 0;

  // 3. Technical symbols, snake_case, camelCase, dot.notation
  const techMatches = Array.from(query.matchAll(TECHNICAL_IDENTIFIER_PATTERN)).map((m) => m[0]);
  const hasTechnicalIdentifier = techMatches.length > 0;

  // 4. Semantic / natural language intent
  const isSemanticQuestion = SEMANTIC_INTERROGATIVE_PATTERN.test(query) || (words.length >= 6 && query.includes("?"));

  const extractedIdentifiers = Array.from(new Set([...codeMatches, ...techMatches]));

  return {
    hasExactCode,
    hasQuotedPhrase,
    hasTechnicalIdentifier,
    isSemanticQuestion,
    tokenCount: words.length,
    extractedIdentifiers,
  };
}

/**
 * Deterministic query routing policy
 */
export function routeQuery(query: string): QueryClassification {
  const features = extractQueryFeatures(query);
  const reasons: string[] = [];

  // Case 1: Pure Exact Identifier or Quoted Phrase without broad semantic query
  // Example: "ERR-104", "ISO-27001-A.9", "'cancellation fee'", "vapi_call_id"
  if (
    (features.hasExactCode || features.hasQuotedPhrase || features.hasTechnicalIdentifier) &&
    !features.isSemanticQuestion &&
    features.tokenCount <= 4
  ) {
    if (features.hasExactCode) reasons.push(`Query contains exact identifier(s): ${features.extractedIdentifiers.join(", ")}`);
    if (features.hasQuotedPhrase) reasons.push("Query contains exact quoted phrase");
    if (features.hasTechnicalIdentifier) reasons.push("Query contains exact technical identifier");

    return {
      strategy: "bm25",
      confidence: 0.95,
      reasons,
      features,
    };
  }

  // Case 2: Mixed Query (Semantic Question + Exact Term / Code / Technical identifier)
  // Example: "What does error WC-104 mean and how do I resolve it?", "Find policy X17 and explain exceptions"
  if (
    (features.hasExactCode || features.hasQuotedPhrase || features.hasTechnicalIdentifier) &&
    (features.isSemanticQuestion || features.tokenCount > 4)
  ) {
    reasons.push("Query combines exact technical identifier(s) with semantic explanation intent");
    reasons.push("Hybrid retrieval (RRF) selected to ensure literal match while maintaining semantic ranking");

    return {
      strategy: "hybrid",
      confidence: 0.9,
      reasons,
      features,
    };
  }

  // Case 3: Pure Natural-Language / Conceptual Semantic Query
  // Example: "How can a customer change their subscription tier?", "Explain the cancellation process in simple terms"
  if (features.isSemanticQuestion && !features.hasExactCode && !features.hasTechnicalIdentifier) {
    reasons.push("Query expresses natural language intent without specific codes or literal identifiers");
    reasons.push("Dense vector retrieval selected for semantic match across phrasing variations");

    return {
      strategy: "dense",
      confidence: 0.88,
      reasons,
      features,
    };
  }

  // Case 4: Short ambiguous / keyword queries -> Default to robust Hybrid (RRF)
  // Example: "enterprise pricing", "refund policy", "billing cycle"
  reasons.push("Query is a general keyword or ambiguous support topic");
  reasons.push("Hybrid retrieval selected as robust default to fuse lexical and semantic signals");

  return {
    strategy: "hybrid",
    confidence: 0.85,
    reasons,
    features,
  };
}
