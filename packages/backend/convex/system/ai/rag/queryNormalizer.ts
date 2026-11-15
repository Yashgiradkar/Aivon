/**
 * RAG Query Normalization & Pre-processing
 * Preserves exact codes, punctuation, and quoted phrases for lexical search
 * while providing standard clean tokens for vector embedding.
 */

export function normalizeSearchQuery(rawQuery: string): string {
  if (!rawQuery) return "";

  // Preserves quoted phrases, exact alphanumeric codes (WC-104), underscores, and hyphens
  return rawQuery
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips special characters for dense embedding models that perform better with clean prose
 */
export function cleanDenseQuery(rawQuery: string): string {
  if (!rawQuery) return "";

  return rawQuery
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
