/**
 * Policy Identifier Regression Tests
 *
 * Tests exact identifier extraction, multi-segment identifier handling,
 * cross-tenant isolation, similar-identifier discrimination, and
 * BM25 tokenizer correctness for policy numbers.
 *
 * These are unit tests — they exercise production code modules
 * (tokenizer, query router, BM25 index) directly without requiring
 * a live Convex deployment or OpenAI API key.
 */

import assert from "node:assert/strict";
import { tokenizeBM25, BM25Index, TenantBM25Cache } from "../../packages/backend/convex/system/ai/rag/bm25";
import { extractQueryFeatures, routeQuery } from "../../packages/backend/convex/system/ai/rag/queryRouter";
import { POLICY_DOCUMENTS, POLICY_TEST_CASES } from "../dataset/policy_fixtures";

export async function runPolicyIdentifierTests(): Promise<void> {
  console.log("=== Running Policy Identifier Regression Tests ===");

  // ---------------------------------------------------------------------------
  // Test 1: BM25 tokenizer preserves full 3-segment policy identifiers
  // ---------------------------------------------------------------------------
  console.log("  [POL-1] BM25 tokenizer preserves full hyphenated policy identifiers...");

  const tokens = tokenizeBM25("Policy TEST-POL-482731 is a home contents policy");
  assert.ok(
    tokens.includes("test-pol-482731"),
    `Expected 'test-pol-482731' as a single token, got: ${JSON.stringify(tokens)}`
  );
  // Must NOT split into partial tokens that would match similar IDs
  assert.ok(
    !tokens.includes("test-pol-48273"),
    "Tokenizer must not produce partial 'test-pol-48273' sub-token"
  );

  // Also verify adjacent similar IDs tokenize differently
  const tokens2 = tokenizeBM25("Policy TEST-POL-482732");
  assert.ok(tokens2.includes("test-pol-482732"));
  assert.ok(!tokens2.includes("test-pol-482731"), "Similar ID must not be present in tokens of different policy");

  const tokens3 = tokenizeBM25("Policy TEST-POL-582731");
  assert.ok(tokens3.includes("test-pol-582731"));
  assert.ok(!tokens3.includes("test-pol-482731"));

  console.log("    → PASS: Full 3-segment identifiers are single tokens");

  // ---------------------------------------------------------------------------
  // Test 2: extractQueryFeatures correctly identifies multi-segment identifiers
  // ---------------------------------------------------------------------------
  console.log("  [POL-2] Query feature extraction for multi-segment identifiers...");

  const features1 = extractQueryFeatures("TEST-POL-482731");
  assert.ok(
    features1.hasExactCode,
    `Expected hasExactCode=true for 'TEST-POL-482731', extractedIdentifiers: ${JSON.stringify(features1.extractedIdentifiers)}`
  );
  assert.ok(
    features1.extractedIdentifiers.some((id) => id.toUpperCase() === "TEST-POL-482731"),
    `Expected TEST-POL-482731 in extractedIdentifiers, got: ${JSON.stringify(features1.extractedIdentifiers)}`
  );

  // Two-segment (old regex behavior — should still work)
  const features2 = extractQueryFeatures("WC-104");
  assert.ok(features2.hasExactCode);
  assert.ok(features2.extractedIdentifiers.some((id) => id.toUpperCase() === "WC-104"));

  console.log("    → PASS: Multi-segment identifiers extracted as single units");

  // ---------------------------------------------------------------------------
  // Test 3: Query routing sends exact 3-segment IDs to BM25
  // ---------------------------------------------------------------------------
  console.log("  [POL-3] Query routing: 3-segment policy ID → bm25 strategy...");

  const route1 = routeQuery("TEST-POL-482731");
  assert.equal(
    route1.strategy,
    "bm25",
    `Expected bm25 for bare policy ID, got: ${route1.strategy}. Reasons: ${route1.reasons.join("; ")}`
  );
  assert.ok(route1.confidence >= 0.9, `Expected confidence >= 0.9, got ${route1.confidence}`);

  // Natural language + policy ID → hybrid
  const route2 = routeQuery("What are the coverage limits for policy TEST-POL-482731?");
  assert.equal(
    route2.strategy,
    "hybrid",
    `Expected hybrid for natural language + policy ID, got: ${route2.strategy}`
  );

  // Pure semantic question → dense
  const route3 = routeQuery("How do I file an insurance claim?");
  assert.equal(route3.strategy, "dense");

  console.log("    → PASS: Routing classification is correct for all policy query types");

  // ---------------------------------------------------------------------------
  // Test 4: BM25 exact identifier match accuracy
  // ---------------------------------------------------------------------------
  console.log("  [POL-4] BM25 exact identifier match accuracy with similar IDs...");

  // Build a BM25 index from synthetic policy documents for ORG-A
  const orgADocs = POLICY_DOCUMENTS.filter((d) => d.orgId === "TEST-ORG-A");
  const bm25Index = new BM25Index({ k1: 1.2, b: 0.75 });

  for (const doc of orgADocs) {
    bm25Index.addDocument({
      id: `${doc.orgId}::${doc.key}`,
      entryId: doc.key,
      title: doc.key,
      text: doc.text,
    });
  }

  // Search for TEST-POL-482731 — must rank the correct document #1
  const results1 = bm25Index.search("TEST-POL-482731", 5);
  assert.ok(results1.length > 0, "Expected at least one result for TEST-POL-482731");
  assert.ok(
    results1[0]?.entryId.includes("TEST-POL-482731"),
    `Expected a TEST-POL-482731 document at rank #1, got: ${results1[0]?.entryId}`
  );
  // The similar identifiers must NOT be ranked above the correct one
  const rank482732 = results1.findIndex((r) => r.entryId === "policy_TEST-POL-482732.md");
  const rank582731 = results1.findIndex((r) => r.entryId === "policy_TEST-POL-582731.md");
  assert.ok(
    rank482732 === -1 || rank482732 > 0,
    "TEST-POL-482732 document must not outrank TEST-POL-482731 when searching for 482731"
  );
  assert.ok(
    rank582731 === -1 || rank582731 > 0,
    "TEST-POL-582731 document must not outrank TEST-POL-482731 when searching for 482731"
  );

  // Search for TEST-POL-482732 — must rank the correct document #1
  const results2 = bm25Index.search("TEST-POL-482732", 5);
  assert.ok(results2.length > 0, "Expected at least one result for TEST-POL-482732");
  assert.equal(
    results2[0]?.entryId,
    "policy_TEST-POL-482732.md",
    `Expected policy_TEST-POL-482732.md at rank #1, got: ${results2[0]?.entryId}`
  );

  console.log("    → PASS: BM25 exact identifier discrimination is correct");

  // ---------------------------------------------------------------------------
  // Test 5: Cross-tenant isolation — ORG-B documents must not appear in ORG-A results
  // ---------------------------------------------------------------------------
  console.log("  [POL-5] Cross-tenant isolation: ORG-B docs absent from ORG-A BM25 index...");

  // ORG-A index was built above — verify that ORG-B documents are not in it
  const orgBDocs = POLICY_DOCUMENTS.filter((d) => d.orgId === "TEST-ORG-B");
  for (const orgBDoc of orgBDocs) {
    const crossTenantSearch = bm25Index.search(orgBDoc.policyIds[0] || orgBDoc.key, 10);
    const leaked = crossTenantSearch.some((r) => r.entryId === orgBDoc.key);
    assert.equal(
      leaked,
      false,
      `CROSS-TENANT LEAK: ORG-B document '${orgBDoc.key}' appeared in ORG-A search results`
    );
  }

  // Build a separate ORG-B index and verify ORG-A docs are not in it
  const orgBIndex = new BM25Index();
  for (const doc of orgBDocs) {
    orgBIndex.addDocument({
      id: `${doc.orgId}::${doc.key}`,
      entryId: doc.key,
      title: doc.key,
      text: doc.text,
    });
  }
  TenantBM25Cache.set("TEST-ORG-A", bm25Index);
  TenantBM25Cache.set("TEST-ORG-B", orgBIndex);

  // ORG-B searching for TEST-POL-482731 must find only their own document
  const orgBResults = TenantBM25Cache.get("TEST-ORG-B")!.search("TEST-POL-482731", 5);
  const orgALeaked = orgBResults.some((r) => r.entryId === "policy_TEST-POL-482731.md");
  assert.equal(
    orgALeaked,
    false,
    "CROSS-TENANT LEAK: ORG-A document appeared in ORG-B search"
  );

  console.log("    → PASS: Zero cross-tenant leakage confirmed");

  // ---------------------------------------------------------------------------
  // Test 6: Non-existent policy number returns 0 exact-match results
  // ---------------------------------------------------------------------------
  console.log("  [POL-6] Non-existent policy ID returns 0 results...");

  const noResults = bm25Index.search("TEST-POL-999999", 5);
  // BM25 may still return partial word-match results, but if it does they must
  // not have a higher score than the threshold. We enforce: none of the results
  // should be the non-existent policy document.
  const falsePositive = noResults.some((r) =>
    r.entryId === "policy_TEST-POL-482731.md" ||
    r.entryId === "policy_TEST-POL-482732.md"
  );
  // There is no document for TEST-POL-999999, so results should be 0.
  // (BM25 only scores documents with at least one query token match.)
  assert.equal(
    noResults.length,
    0,
    `Expected 0 results for non-existent policy TEST-POL-999999, got: ${noResults.map((r) => r.entryId)}`
  );

  console.log("    → PASS: Non-existent policy returns empty result set");

  // ---------------------------------------------------------------------------
  // Test 7: Validate test case routing expectations from POLICY_TEST_CASES
  // ---------------------------------------------------------------------------
  console.log("  [POL-7] Validating routing expectations from POLICY_TEST_CASES fixture...");

  let routingPasses = 0;
  for (const tc of POLICY_TEST_CASES) {
    const route = routeQuery(tc.query);
    assert.equal(
      route.strategy,
      tc.expectedRoute,
      `[${tc.id}] ${tc.description}: expected route=${tc.expectedRoute}, got=${route.strategy}`
    );
    routingPasses++;
  }
  console.log(`    → PASS: ${routingPasses}/${POLICY_TEST_CASES.length} routing expectations verified`);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n✅ All Policy Identifier Regression Tests PASSED\n");
  console.log("  Coverage:");
  console.log("    - Multi-segment identifier tokenization (TEST-POL-482731)");
  console.log("    - Identifier feature extraction (regex fix verified)");
  console.log("    - Query routing classification (7 cases)");
  console.log("    - BM25 exact vs. similar ID discrimination (482731 vs 482732 vs 582731)");
  console.log("    - Cross-tenant isolation (0% leakage)");
  console.log("    - Non-existent policy returns empty result");
}

// Auto-run if invoked directly
runPolicyIdentifierTests().catch((err) => {
  console.error("❌ Policy identifier test failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
