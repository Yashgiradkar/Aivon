import assert from "node:assert/strict";
import {
  ProductionKVCache,
  MultiTenantRetrievalCache,
  SemanticAnswerKVCache,
} from "../../packages/backend/convex/system/ai/cache";

export async function runProductionKVCacheTests(): Promise<void> {
  console.log("=== Running Production KV Cache Test Suite ===");

  // ---------------------------------------------------------------------------
  // Test 1: Basic Cache Operations (Set, Get, Miss, Delete, Has)
  // ---------------------------------------------------------------------------
  console.log("1. Testing Basic Cache Operations (Hit, Miss, Delete, Has)...");
  const cache = new ProductionKVCache<string>({
    maxEntries: 100,
    defaultTtlMs: 5000,
    namespace: "test_basic",
    version: "v1",
  });

  assert.equal(cache.get("org_alpha", "greeting"), null);
  assert.equal(cache.has("org_alpha", "greeting"), false);

  cache.set("org_alpha", "greeting", "Hello World");
  assert.equal(cache.has("org_alpha", "greeting"), true);
  assert.equal(cache.get("org_alpha", "greeting"), "Hello World");

  assert.equal(cache.delete("org_alpha", "greeting"), true);
  assert.equal(cache.get("org_alpha", "greeting"), null);
  assert.equal(cache.has("org_alpha", "greeting"), false);
  console.log("   ✓ Basic operations passed");

  // ---------------------------------------------------------------------------
  // Test 2: Strict Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log("2. Testing Strict Multi-Tenant Isolation & Zero Leakage...");
  const multiTenantCache = new ProductionKVCache<{ role: string; plan: string }>({
    maxEntries: 100,
    namespace: "security",
  });

  multiTenantCache.set("org_acme", "user_profile", { role: "admin", plan: "enterprise" });
  multiTenantCache.set("org_beta", "user_profile", { role: "guest", plan: "free" });

  const acmeProfile = multiTenantCache.get("org_acme", "user_profile");
  const betaProfile = multiTenantCache.get("org_beta", "user_profile");
  const gammaProfile = multiTenantCache.get("org_gamma", "user_profile");

  assert.deepEqual(acmeProfile, { role: "admin", plan: "enterprise" });
  assert.deepEqual(betaProfile, { role: "guest", plan: "free" });
  assert.equal(gammaProfile, null);

  // Invalidate only Acme
  const deletedCount = multiTenantCache.invalidateTenant("org_acme");
  assert.equal(deletedCount, 1);
  assert.equal(multiTenantCache.get("org_acme", "user_profile"), null);
  // Beta must remain completely intact
  assert.deepEqual(multiTenantCache.get("org_beta", "user_profile"), { role: "guest", plan: "free" });

  // Missing or empty tenantId MUST throw to guarantee zero cross-tenant leakage
  assert.throws(() => multiTenantCache.get("", "user_profile"), /Tenant ID is strictly required/);
  assert.throws(() => multiTenantCache.set("", "user_profile", { role: "x", plan: "y" }), /Tenant ID is strictly required/);
  console.log("   ✓ Multi-tenant isolation verified with zero leakage");

  // ---------------------------------------------------------------------------
  // Test 3: TTL Expiration & Lazy/Proactive Eviction
  // ---------------------------------------------------------------------------
  console.log("3. Testing TTL Expiration & Proactive Eviction...");
  const ttlCache = new ProductionKVCache<number>({
    maxEntries: 50,
    defaultTtlMs: 50, // 50ms TTL
    namespace: "ttl",
  });

  ttlCache.set("org_1", "temp_metric", 42, { ttlMs: 40 });
  assert.equal(ttlCache.get("org_1", "temp_metric"), 42);

  // Wait for TTL expiration
  await new Promise((r) => setTimeout(r, 60));

  // Lazy eviction on get
  assert.equal(ttlCache.get("org_1", "temp_metric"), null);
  const stats = ttlCache.getStats();
  assert.ok(stats.expirations >= 1);

  // Proactive pruning
  ttlCache.set("org_1", "temp_metric_2", 99, { ttlMs: 30 });
  await new Promise((r) => setTimeout(r, 45));
  const pruned = ttlCache.pruneExpired();
  assert.equal(pruned, 1);
  assert.equal(ttlCache.size(), 0);
  console.log("   ✓ TTL expiration and pruning verified");

  // ---------------------------------------------------------------------------
  // Test 4: O(1) LRU Eviction Under Hard Capacity Ceilings
  // ---------------------------------------------------------------------------
  console.log("4. Testing LRU Eviction Under Hard Capacity Ceilings...");
  const lruCache = new ProductionKVCache<string>({
    maxEntries: 3, // Capacity = 3
    namespace: "lru",
  });

  lruCache.set("org_lru", "k1", "v1");
  lruCache.set("org_lru", "k2", "v2");
  lruCache.set("org_lru", "k3", "v3");
  assert.equal(lruCache.size(), 3);

  // Access k1 to make it most recently used (Order becomes: k2, k3, k1)
  assert.equal(lruCache.get("org_lru", "k1"), "v1");

  // Insert k4 -> should evict k2 (least recently used)
  lruCache.set("org_lru", "k4", "v4");
  assert.equal(lruCache.size(), 3);
  assert.equal(lruCache.get("org_lru", "k2"), null); // Evicted!
  assert.equal(lruCache.get("org_lru", "k1"), "v1"); // Retained!
  assert.equal(lruCache.get("org_lru", "k3"), "v3"); // Retained!
  assert.equal(lruCache.get("org_lru", "k4"), "v4"); // Retained!

  const lruStats = lruCache.getStats();
  assert.equal(lruStats.evictions, 1);
  console.log("   ✓ LRU eviction successfully preserves hot keys and caps memory");

  // ---------------------------------------------------------------------------
  // Test 5: Concurrency Safety & Stampede Protection (Request Coalescing)
  // ---------------------------------------------------------------------------
  console.log("5. Testing Stampede Protection & Singleflight Request Coalescing...");
  const coalescingCache = new ProductionKVCache<string>({
    maxEntries: 100,
    namespace: "stampede",
  });

  let fetchExecutionCount = 0;
  const expensiveBackendFetcher = async (): Promise<string> => {
    fetchExecutionCount++;
    await new Promise((r) => setTimeout(r, 50)); // Simulate 50ms database/vector query
    return "expensive_result";
  };

  // Launch 15 concurrent identical requests for the same uncached key
  const concurrentCalls = Array.from({ length: 15 }, () =>
    coalescingCache.getOrSet("org_coalesce", "heavy_query", expensiveBackendFetcher)
  );

  const results = await Promise.all(concurrentCalls);

  // All 15 callers must receive the exact result
  for (const res of results) {
    assert.equal(res, "expensive_result");
  }

  // Under stampede protection, fetcher MUST have executed exactly ONCE!
  assert.equal(fetchExecutionCount, 1, `Fetcher ran ${fetchExecutionCount} times instead of 1!`);

  const coalescedStats = coalescingCache.getStats();
  assert.equal(coalescedStats.coalescedRequests, 14, "14 concurrent requests coalesced");
  console.log("   ✓ Stampede protection verified: 15 concurrent requests resulted in exactly 1 fetch");

  // ---------------------------------------------------------------------------
  // Test 6: Negative Caching with Bounded Shorter TTL
  // ---------------------------------------------------------------------------
  console.log("6. Testing Negative Caching with Shorter TTL...");
  const negativeCache = new ProductionKVCache<{ data: string[] | null }>({
    maxEntries: 100,
    defaultTtlMs: 60000,
    namespace: "negative",
  });

  let negativeFetcherCalls = 0;
  const emptyFetcher = async () => {
    negativeFetcherCalls++;
    return { data: null }; // Not found / empty evidence
  };

  const val1 = await negativeCache.getOrSet(
    "org_neg",
    "missing_doc",
    emptyFetcher,
    {
      negativeTtlMs: 100,
      isNegative: (val) => !val.data || val.data.length === 0,
    }
  );
  assert.deepEqual(val1, { data: null });
  assert.equal(negativeFetcherCalls, 1);

  // Second call within negative TTL hits negative cache directly
  const val2 = await negativeCache.getOrSet(
    "org_neg",
    "missing_doc",
    emptyFetcher,
    {
      negativeTtlMs: 100,
      isNegative: (val) => !val.data || val.data.length === 0,
    }
  );
  assert.deepEqual(val2, { data: null });
  assert.equal(negativeFetcherCalls, 1); // No re-fetch!

  const negStats = negativeCache.getStats();
  assert.equal(negStats.negativeHits, 1);
  console.log("   ✓ Negative caching successfully prevented repeated missing resource queries");

  // ---------------------------------------------------------------------------
  // Test 7: Error Resilience & Graceful Fallback
  // ---------------------------------------------------------------------------
  console.log("7. Testing Error Resilience & Fetcher Rejection Recovery...");
  const errorCache = new ProductionKVCache<string>({
    maxEntries: 100,
    namespace: "errors",
  });

  let failureAttempts = 0;
  const failingFetcher = async (): Promise<string> => {
    failureAttempts++;
    throw new Error("Temporary network timeout");
  };

  // Attempting fetcher that throws must not poison cache or lock in-flight registry
  await assert.rejects(
    () => errorCache.getOrSet("org_err", "faulty_query", failingFetcher),
    /Temporary network timeout/
  );

  // Next call should be allowed to retry immediately
  const successFetcher = async () => "recovered_value";
  const recovered = await errorCache.getOrSet("org_err", "faulty_query", successFetcher);
  assert.equal(recovered, "recovered_value");
  console.log("   ✓ Error recovery verified with zero in-flight lock leakage");

  // ---------------------------------------------------------------------------
  // Test 8: Integrated MultiTenantRetrievalCache & SemanticAnswerKVCache
  // ---------------------------------------------------------------------------
  console.log("8. Testing MultiTenantRetrievalCache & SemanticAnswerKVCache Integration...");
  MultiTenantRetrievalCache.clear();
  SemanticAnswerKVCache.clear();

  MultiTenantRetrievalCache.set("org_test", "what is refund policy", "Refund within 30 days.", ["Policy.pdf"]);
  const hitRetrieval = MultiTenantRetrievalCache.get("org_test", "what is refund policy");
  assert.ok(hitRetrieval !== null);
  assert.equal(hitRetrieval?.resultText, "Refund within 30 days.");
  assert.deepEqual(hitRetrieval?.titles, ["Policy.pdf"]);

  // Test SemanticAnswerKVCache L1
  SemanticAnswerKVCache.set("org_test", "how do i cancel", {
    response: "You can cancel anytime in settings.",
    evidenceReferences: ["faq.md"],
    canonicalQuery: "how do i cancel",
    model: "gpt-4o-mini",
  });

  const hitSemantic = SemanticAnswerKVCache.get("org_test", "how do i cancel");
  assert.ok(hitSemantic !== null);
  assert.equal(hitSemantic?.response, "You can cancel anytime in settings.");

  // Tenant-wide purge cleans both retrieval and semantic caches
  MultiTenantRetrievalCache.invalidateOrg("org_test");
  SemanticAnswerKVCache.invalidateOrg("org_test");
  assert.equal(MultiTenantRetrievalCache.get("org_test", "what is refund policy"), null);
  assert.equal(SemanticAnswerKVCache.get("org_test", "how do i cancel"), null);
  console.log("   ✓ Integrated retrieval and semantic caches operate seamlessly");

  // ---------------------------------------------------------------------------
  // Test 9: High-Throughput Micro-Benchmark
  // ---------------------------------------------------------------------------
  console.log("9. Running High-Throughput Latency Benchmark (10,000 Operations)...");
  const benchCache = new ProductionKVCache<number>({
    maxEntries: 5000,
    namespace: "benchmark",
  });

  const OPS = 10_000;
  const benchStart = performance.now();

  for (let i = 0; i < OPS; i++) {
    const key = `key_${i % 1000}`; // 1000 unique keys to guarantee 90% hit ratio
    if (i < 1000) {
      benchCache.set("org_bench", key, i);
    } else {
      benchCache.get("org_bench", key);
    }
  }

  const benchDurationMs = performance.now() - benchStart;
  const opsPerSec = Math.round((OPS / benchDurationMs) * 1000);
  const avgLatencyUs = ((benchDurationMs * 1000) / OPS).toFixed(2);

  console.log(`   Benchmark Results: ${OPS} ops in ${benchDurationMs.toFixed(2)}ms`);
  console.log(`   Throughput: ${opsPerSec.toLocaleString()} ops/sec | Avg Latency: ${avgLatencyUs} µs/op`);
  assert.ok(opsPerSec > 50_000, `Throughput must exceed 50k ops/sec (achieved ${opsPerSec})`);

  console.log("✅ All Production KV Cache Unit & Benchmark Tests Passed Successfully!");
}

runProductionKVCacheTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
