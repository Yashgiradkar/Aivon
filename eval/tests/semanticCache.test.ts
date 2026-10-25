import assert from "node:assert/strict";
import {
  SemanticCacheLogic,
} from "../../packages/backend/convex/system/ai/cache/semanticCache";

export async function runSemanticCacheTests(): Promise<void> {
  console.log("Running Semantic Cache & Prompt Optimization Tests...");

  // Test 1: Cache eligibility - Rejection of volatile, payment, and account queries
  const balanceQuery = SemanticCacheLogic.evaluateEligibility("What is my current account balance today?");
  assert.equal(balanceQuery.eligible, false);
  assert.ok(balanceQuery.reason?.includes("volatile"));

  const escalateQuery = SemanticCacheLogic.evaluateEligibility("I need to speak with an agent right now");
  assert.equal(escalateQuery.eligible, false);

  const shortQuery = SemanticCacheLogic.evaluateEligibility("hi");
  assert.equal(shortQuery.eligible, false);
  assert.ok(shortQuery.reason?.includes("short"));

  // Test 2: Cache eligibility - Acceptance of generic knowledge/policy queries
  const factualQuery = SemanticCacheLogic.evaluateEligibility("What are your business hours on weekends?");
  assert.equal(factualQuery.eligible, true);

  const policyQuery = SemanticCacheLogic.evaluateEligibility("How does the commercial deductible policy work?");
  assert.equal(policyQuery.eligible, true);

  // Test 3: Side effects or personal data exclusion
  const personalQuery = SemanticCacheLogic.evaluateEligibility("What are your refund terms?", {
    hasPersonalData: true,
  });
  assert.equal(personalQuery.eligible, false);
  assert.ok(personalQuery.reason?.includes("personalized"));

  // Test 4: Canonical normalization and query hashing
  const q1 = "What are your business hours on weekends?";
  const q2 = "  what are your business hours on weekends?!  ";
  const norm1 = SemanticCacheLogic.normalizeQuery(q1);
  const norm2 = SemanticCacheLogic.normalizeQuery(q2);
  assert.equal(norm1, norm2);

  const hash1 = SemanticCacheLogic.hashQuery(norm1);
  const hash2 = SemanticCacheLogic.hashQuery(norm2);
  assert.equal(hash1, hash2);
  assert.ok(hash1.startsWith("q_hash_"));

  // Test 5: Cosine similarity computation
  const vecA = [1, 0, 0, 0];
  const vecB = [1, 0, 0, 0];
  const vecC = [0, 1, 0, 0];
  const vecD = [0.9, 0.1, 0, 0];

  const simIdentical = SemanticCacheLogic.cosineSimilarity(vecA, vecB);
  assert.ok(Math.abs(simIdentical - 1.0) < 0.001);

  const simOrthogonal = SemanticCacheLogic.cosineSimilarity(vecA, vecC);
  assert.equal(simOrthogonal, 0);

  const simClose = SemanticCacheLogic.cosineSimilarity(vecA, vecD);
  assert.ok(simClose > 0.95);

  // Test 6: Prompt Prefix Optimization for OpenAI / Anthropic KV Cache
  const promptOptimization = SemanticCacheLogic.assemblePromptWithPrefixOptimization({
    systemPrompt: "You are Aivon Support AI. Always follow company safety policies.",
    toolDefinitions: '{"name": "search", "description": "Search knowledge base"}',
    dynamicContext: "Customer: What is your cancellation policy?",
  });

  assert.ok(promptOptimization.staticPrefix.includes("You are Aivon Support AI"));
  assert.ok(promptOptimization.staticPrefix.includes("<static_tools>"));
  assert.ok(promptOptimization.dynamicSuffix.includes("Customer: What is your cancellation policy?"));
  assert.ok(promptOptimization.fullPrompt.startsWith(promptOptimization.staticPrefix));

  console.log("✅ All Semantic Cache & Prompt Optimization Tests Passed Successfully!");
}

runSemanticCacheTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

