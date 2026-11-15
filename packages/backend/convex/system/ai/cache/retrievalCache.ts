/**
 * Multi-Tenant In-Memory Retrieval KV Cache
 *
 * Prevents redundant vector search calls and lexical queries for repeated queries within the same organization.
 * Strictly isolates cached responses by tenant ID, with bounded capacity, LRU eviction, and stampede protection.
 */

import { ProductionKVCache } from "./kvCache";

export interface RetrievalCacheEntry {
  resultText: string;
  titles: string[];
}

const internalCache = new ProductionKVCache<RetrievalCacheEntry>({
  maxEntries: 5000,
  defaultTtlMs: 5 * 60 * 1000, // 5 minutes TTL
  namespace: "retrieval",
  version: "v1",
});

export class MultiTenantRetrievalCache {
  public static get(
    orgId: string,
    query: string
  ): { resultText: string; titles: string[] } | null {
    if (!orgId || !query) return null;
    return internalCache.get(orgId, query);
  }

  public static set(
    orgId: string,
    query: string,
    resultText: string,
    titles: string[],
    ttlMs?: number
  ): void {
    if (!orgId || !query) return;
    const isNegative = !resultText || resultText.trim().length === 0;
    internalCache.set(
      orgId,
      query,
      { resultText, titles },
      {
        ttlMs,
        isNegative,
      }
    );
  }

  /**
   * Stampede-protected retrieval using Singleflight request coalescing.
   */
  public static async getOrFetch(
    orgId: string,
    query: string,
    fetcher: () => Promise<{ resultText: string; titles: string[] }>,
    ttlMs?: number
  ): Promise<{ resultText: string; titles: string[] }> {
    return await internalCache.getOrSet(
      orgId,
      query,
      fetcher,
      {
        ttlMs,
        negativeTtlMs: 60_000, // 1 min negative cache for empty results
        isNegative: (val) => !val || !val.resultText || val.resultText.trim().length === 0,
      }
    );
  }

  public static invalidateOrg(orgId: string): void {
    if (!orgId) return;
    internalCache.invalidateTenant(orgId);
  }

  public static getStats() {
    return internalCache.getStats();
  }

  public static clear(): void {
    internalCache.clear();
  }

  public static pruneExpired(): number {
    return internalCache.pruneExpired();
  }
}
