/**
 * Adaptive Document Tiering Engine for RAG Embeddings
 *
 * Implements intelligent model routing between OpenAI text-embedding-3-small (1536-dim)
 * and text-embedding-3-large (3072-dim) based on document volume, semantic crowding,
 * and domain specificity.
 *
 * Criteria:
 * 1. Semantic Crowding Across Large Corpora (> 100 pages):
 *    Routes to text-embedding-3-large (3072 dimensions) to expand hyper-dimensional
 *    separation and boost Precision@k on fine-grained distinctions.
 * 2. High Domain Specificity & Subtle Terminology:
 *    Detects dense tabular metrics (e.g., "$29/mo" vs "$29/yr", tiered SLA clauses,
 *    statutory/contractual terms, API specifications) and routes to text-embedding-3-large.
 * 3. Cost-Optimized Standard FAQ/KB (<= 50 pages):
 *    Documents under or equal to 50 pages stay on text-embedding-3-small (1536 dimensions,
 *    $0.02 / 1M tokens), preventing unnecessary 6.5x cost inflation.
 * 4. Dimension-Segregated Namespaces:
 *    Separates Convex vector namespaces by dimension (`${orgId}` vs `${orgId}:large`)
 *    to eliminate dimensional mismatch in vector similarity search.
 */

export type DocumentEmbeddingTier = "small" | "large";

export interface TierConfiguration {
  model: "text-embedding-3-small" | "text-embedding-3-large";
  dimension: 1536 | 3072;
  costPer1MTokens: number; // in USD
  namespaceSuffix: string;
}

export const TIER_CONFIGURATIONS: Record<DocumentEmbeddingTier, TierConfiguration> = {
  small: {
    model: "text-embedding-3-small",
    dimension: 1536,
    costPer1MTokens: 0.02,
    namespaceSuffix: "",
  },
  large: {
    model: "text-embedding-3-large",
    dimension: 3072,
    costPer1MTokens: 0.13,
    namespaceSuffix: ":large",
  },
};

export const STANDARD_PAGE_THRESHOLD = 50;
export const LARGE_PAGE_THRESHOLD = 100;

export interface TierClassificationParams {
  pageCount: number;
  text?: string;
  filename?: string;
  mimeType?: string;
  hasDenseTables?: boolean;
}

export interface TierClassificationResult {
  tier: DocumentEmbeddingTier;
  model: string;
  dimension: number;
  namespaceSuffix: string;
  reason: string;
  costPer1MTokens: number;
  detectedSignals: {
    pageCount: number;
    semanticCrowdingRisk: boolean;
    denseTabularMetrics: boolean;
    subtleTerminology: boolean;
  };
}

// Regex matching subtle pricing differences, tiered SLA clauses, legal contracts, and API specs
const SUBTLE_TERMINOLOGY_REGEX =
  /\b(\$\d+(\.\d{2})?\s*\/\s*(mo|month|yr|year|user)|sla|service level agreement|uptime guarantee|99\.\d+%\b|\btier [1-4]\b|indemnif|liability limitation|arbitration clause|confidentiality obligations|force majeure|sec filing|10-k|10-q|rest api spec|openapi|graphql schema|oauth2 flow)\b/i;

// Regex matching structured table indicators (markdown tables, HTML tables, CSV delimiters)
const DENSE_TABLE_INDICATOR_REGEX =
  /(\|(?:\s*[^|\r\n]+\s*\|){2,}\r?\n\|(?:\s*[-:]+[-| :]*\|)\r?\n)|(<table[\s>])|((?:[^\r\n,]+,){3,}[^\r\n,]+\r?\n){3,}/i;

/**
 * Evaluates whether text exhibits subtle domain terminology or high-specificity distinctions.
 */
export function detectSubtleDomainTerminology(text: string): boolean {
  if (!text) return false;
  return SUBTLE_TERMINOLOGY_REGEX.test(text);
}

/**
 * Evaluates whether text contains dense tables or fine-grained metrics.
 */
export function detectDenseTabularMetrics(text: string): boolean {
  if (!text) return false;
  return DENSE_TABLE_INDICATOR_REGEX.test(text);
}

/**
 * Classifies a document into either the standard (1536-dim) or large (3072-dim) embedding tier.
 */
export function classifyDocumentTier(
  params: TierClassificationParams
): TierClassificationResult {
  const pageCount = Math.max(1, params.pageCount);
  const text = params.text ?? "";

  const semanticCrowdingRisk = pageCount > LARGE_PAGE_THRESHOLD;
  const denseTabularMetrics =
    params.hasDenseTables === true || detectDenseTabularMetrics(text);
  const subtleTerminology = detectSubtleDomainTerminology(text);

  // Rule 1: Semantic Crowding across large corpora (> 100 pages)
  if (semanticCrowdingRisk) {
    const config = TIER_CONFIGURATIONS.large;
    return {
      tier: "large",
      model: config.model,
      dimension: config.dimension,
      namespaceSuffix: config.namespaceSuffix,
      reason: `Semantic crowding prevention: High-volume corpus (${pageCount} pages > ${LARGE_PAGE_THRESHOLD} threshold) routes to text-embedding-3-large (3072 dimensions) to expand hyper-dimensional separation and boost Precision@k.`,
      costPer1MTokens: config.costPer1MTokens,
      detectedSignals: {
        pageCount,
        semanticCrowdingRisk: true,
        denseTabularMetrics,
        subtleTerminology,
      },
    };
  }

  // Rule 2: High Domain Specificity & Subtle Terminology / Dense Tabular Metrics
  // Applicable when document has fine-grained distinctions or is between 51-100 pages
  if (denseTabularMetrics && subtleTerminology) {
    const config = TIER_CONFIGURATIONS.large;
    return {
      tier: "large",
      model: config.model,
      dimension: config.dimension,
      namespaceSuffix: config.namespaceSuffix,
      reason: `High domain specificity & subtle terminology: Document contains dense tabular metrics and subtle distinctions (e.g. pricing tiers, SLA clauses), routing to text-embedding-3-large (3072 dimensions) for nuanced vector representation.`,
      costPer1MTokens: config.costPer1MTokens,
      detectedSignals: {
        pageCount,
        semanticCrowdingRisk: false,
        denseTabularMetrics: true,
        subtleTerminology: true,
      },
    };
  }

  // Rule 3: Intermediate volumes (51-100 pages) with at least one high-specificity signal
  if (pageCount > STANDARD_PAGE_THRESHOLD && (denseTabularMetrics || subtleTerminology)) {
    const config = TIER_CONFIGURATIONS.large;
    return {
      tier: "large",
      model: config.model,
      dimension: config.dimension,
      namespaceSuffix: config.namespaceSuffix,
      reason: `Multi-section manual with specific terminology (${pageCount} pages > ${STANDARD_PAGE_THRESHOLD} threshold) upgraded to text-embedding-3-large.`,
      costPer1MTokens: config.costPer1MTokens,
      detectedSignals: {
        pageCount,
        semanticCrowdingRisk: false,
        denseTabularMetrics,
        subtleTerminology,
      },
    };
  }

  // Rule 4: Standard FAQ / Knowledge Base (<= 50 pages of general documentation)
  const config = TIER_CONFIGURATIONS.small;
  return {
    tier: "small",
    model: config.model,
    dimension: config.dimension,
    namespaceSuffix: config.namespaceSuffix,
    reason: `Cost-optimized standard FAQ/KB: Document (${pageCount} pages <= ${STANDARD_PAGE_THRESHOLD} threshold) stays on text-embedding-3-small (1536 dimensions, $0.02/1M tokens) to minimize embedding costs and RAM usage.`,
    costPer1MTokens: config.costPer1MTokens,
    detectedSignals: {
      pageCount,
      semanticCrowdingRisk: false,
      denseTabularMetrics,
      subtleTerminology,
    },
  };
}

/**
 * Returns the segregated Convex vector namespace for an organization and document tier.
 */
export function getTieredNamespace(
  organizationId: string,
  tier: DocumentEmbeddingTier
): string {
  if (!organizationId) {
    throw new Error("[AdaptiveTiering] organizationId is required for namespace generation.");
  }
  const suffix = TIER_CONFIGURATIONS[tier].namespaceSuffix;
  return `${organizationId.trim()}${suffix}`;
}

/**
 * Factory for creating an adaptive OpenAI embedding provider targeting the designated tier.
 */
export function createAdaptiveEmbeddingProvider(tier: DocumentEmbeddingTier) {
  const config = TIER_CONFIGURATIONS[tier];

  return async (texts: string[]): Promise<number[][]> => {
    const { embedMany } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");
    const model = openai.embedding(config.model);
    const results: number[][] = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const { embeddings } = await embedMany({
        model,
        values: batch,
      });
      results.push(...embeddings);
    }

    return results;
  };
}
