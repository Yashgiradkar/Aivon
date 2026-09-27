/**
 * RAG Query Normalization & Pre-processing
 */

export function normalizeSearchQuery(rawQuery: string): string {
  if (!rawQuery) return "";

  return rawQuery
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ") // replace special characters with whitespace
    .replace(/\s+/g, " ")       // collapse consecutive spaces
    .trim();
}
