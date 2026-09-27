/**
 * Multi-Tenant In-Memory Retrieval Cache
 *
 * Prevents redundant vector search calls for repeated queries within the same organization.
 * Strictly isolates cached responses by tenant ID.
 */

interface CacheEntry {
  resultText: string;
  titles: string[];
  expiresAt: number;
}

const cacheMap = new Map<string, CacheEntry>();

export class MultiTenantRetrievalCache {
  private static defaultTtlMs = 5 * 60 * 1000; // 5 minutes TTL

  private static makeKey(orgId: string, normalizedQuery: string): string {
    return `${orgId}::${normalizedQuery.trim().toLowerCase()}`;
  }

  public static get(orgId: string, query: string): { resultText: string; titles: string[] } | null {
    const key = this.makeKey(orgId, query);
    const entry = cacheMap.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      cacheMap.delete(key);
      return null;
    }

    return {
      resultText: entry.resultText,
      titles: entry.titles,
    };
  }

  public static set(
    orgId: string,
    query: string,
    resultText: string,
    titles: string[],
    ttlMs: number = this.defaultTtlMs
  ): void {
    const key = this.makeKey(orgId, query);
    cacheMap.set(key, {
      resultText,
      titles,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public static invalidateOrg(orgId: string): void {
    for (const key of cacheMap.keys()) {
      if (key.startsWith(`${orgId}::`)) {
        cacheMap.delete(key);
      }
    }
  }
}
