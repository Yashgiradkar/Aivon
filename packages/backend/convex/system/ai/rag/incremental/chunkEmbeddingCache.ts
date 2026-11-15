/**
 * Multi-Tenant Content-Addressable Chunk Embedding Cache.
 * Enables zero-cost embedding reuse for unchanged document chunks across updates.
 * Keys are strictly scoped to the tenant organizationId and SHA-256 chunk hash.
 */
export class ChunkEmbeddingCache {
  private static cache = new Map<string, number[]>();
  private static accessOrder = new Map<string, number>();
  private static readonly MAX_ENTRIES = 25000; // In-memory ceiling per process

  private static makeKey(organizationId: string, chunkHash: string): string {
    return `${organizationId}:${chunkHash}`;
  }

  /**
   * Retrieves a cached embedding vector for a given chunk hash within a tenant's scope.
   */
  static get(organizationId: string, chunkHash: string): number[] | undefined {
    const key = this.makeKey(organizationId, chunkHash);
    const vector = this.cache.get(key);
    if (vector) {
      this.accessOrder.set(key, Date.now());
    }
    return vector;
  }

  /**
   * Caches an embedding vector for a chunk hash.
   */
  static set(
    organizationId: string,
    chunkHash: string,
    vector: number[],
  ): void {
    const key = this.makeKey(organizationId, chunkHash);
    this.ensureCapacity();
    this.cache.set(key, vector);
    this.accessOrder.set(key, Date.now());
  }

  /**
   * Retrieves cached embeddings for a batch of chunk hashes.
   * Returns a map of found embeddings and an array of missing hashes that must be embedded.
   */
  static getBatch(
    organizationId: string,
    chunkHashes: string[],
  ): {
    cached: Map<string, number[]>;
    missing: string[];
  } {
    const cached = new Map<string, number[]>();
    const missing: string[] = [];

    for (const hash of chunkHashes) {
      const vector = this.get(organizationId, hash);
      if (vector) {
        cached.set(hash, vector);
      } else {
        missing.push(hash);
      }
    }

    return { cached, missing };
  }

  /**
   * Stores a batch of chunk embeddings in cache.
   */
  static setBatch(
    organizationId: string,
    entries: Array<{ chunkHash: string; vector: number[] }>,
  ): void {
    for (const entry of entries) {
      this.set(organizationId, entry.chunkHash, entry.vector);
    }
  }

  /**
   * Checks if an embedding exists in cache.
   */
  static has(organizationId: string, chunkHash: string): boolean {
    return this.cache.has(this.makeKey(organizationId, chunkHash));
  }

  /**
   * Prunes embeddings belonging to a tenant that are no longer referenced.
   */
  static pruneStale(
    organizationId: string,
    activeHashes: Set<string>,
  ): number {
    const prefix = `${organizationId}:`;
    let prunedCount = 0;

    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        const hash = key.slice(prefix.length);
        if (!activeHashes.has(hash)) {
          this.cache.delete(key);
          this.accessOrder.delete(key);
          prunedCount++;
        }
      }
    }

    return prunedCount;
  }

  /**
   * Purges all cache entries for a specific organization (e.g. on tenant offboarding).
   */
  static invalidateOrg(organizationId: string): void {
    const prefix = `${organizationId}:`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
      }
    }
  }

  /**
   * Resets the entire cache (useful for testing and deterministic benchmark evaluations).
   */
  static clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
  }

  /**
   * Returns current cache size.
   */
  static size(): number {
    return this.cache.size;
  }

  /**
   * Enforces LRU memory ceiling.
   */
  private static ensureCapacity(): void {
    if (this.cache.size < this.MAX_ENTRIES) return;

    // Evict oldest 10% of entries
    const sorted = Array.from(this.accessOrder.entries()).sort(
      (a, b) => a[1] - b[1],
    );
    const toRemove = Math.ceil(this.MAX_ENTRIES * 0.1);

    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      const entry = sorted[i];
      if (!entry) continue;
      const [oldestKey] = entry;
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }
}

