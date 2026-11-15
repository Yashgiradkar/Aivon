import assert from "node:assert/strict";
import {
  classifyDocumentTier,
  getTieredNamespace,
  detectDenseTabularMetrics,
  detectSubtleDomainTerminology,
  STANDARD_PAGE_THRESHOLD,
  LARGE_PAGE_THRESHOLD,
  TIER_CONFIGURATIONS,
} from "../../packages/backend/convex/system/ai/rag/adaptiveTiering";
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from "../../packages/backend/convex/lib/sessionToken";

export async function runAdaptiveTieringAndSessionSecurityTests(): Promise<void> {
  console.log("=== Running Adaptive Document Tiering & Cryptographic Session Security Tests ===");

  // =========================================================================
  // Part 1: Adaptive Document Tiering Tests
  // =========================================================================
  console.log("\n--- Part 1: Testing Adaptive Document Tiering & Model Selection ---");

  // Test 1.1: Standard KB / FAQ (<= 50 pages) stays on text-embedding-3-small (1536-dim)
  console.log("1.1 Testing Standard KB / FAQ (<= 50 pages) Cost Optimization...");
  const standardDoc = classifyDocumentTier({
    pageCount: 15,
    text: "Welcome to our customer portal. You can view your recent orders and update your shipping address in the account tab.",
    filename: "faq_basics.md",
  });
  assert.equal(standardDoc.tier, "small");
  assert.equal(standardDoc.model, "text-embedding-3-small");
  assert.equal(standardDoc.dimension, 1536);
  assert.equal(standardDoc.costPer1MTokens, 0.02);
  assert.ok(standardDoc.reason.includes("Cost-optimized standard FAQ/KB"));
  console.log("   ✓ Standard KB (15 pages) correctly routed to text-embedding-3-small (1536 dims)");

  // Test 1.2: Boundary check at exactly 50 pages
  const boundaryDoc50 = classifyDocumentTier({
    pageCount: 50,
    text: "General user handbook for workspace navigation and basic team settings.",
    filename: "user_guide.pdf",
  });
  assert.equal(boundaryDoc50.tier, "small");
  assert.equal(boundaryDoc50.dimension, 1536);
  console.log("   ✓ Boundary at exactly 50 pages stays on text-embedding-3-small");

  // Test 1.3: High-Volume Multi-Section Manual (> 100 pages) routes to text-embedding-3-large (3072-dim)
  console.log("1.3 Testing Semantic Crowding Prevention on High-Volume Corpora (> 100 pages)...");
  const largeManualDoc = classifyDocumentTier({
    pageCount: 120,
    text: "Comprehensive Enterprise Architecture and Operations Manual covering 40 modules and legacy migration paths.",
    filename: "enterprise_architecture_spec.pdf",
  });
  assert.equal(largeManualDoc.tier, "large");
  assert.equal(largeManualDoc.model, "text-embedding-3-large");
  assert.equal(largeManualDoc.dimension, 3072);
  assert.equal(largeManualDoc.costPer1MTokens, 0.13);
  assert.ok(largeManualDoc.reason.includes("Semantic crowding prevention"));
  assert.equal(largeManualDoc.detectedSignals.semanticCrowdingRisk, true);
  console.log("   ✓ High-volume manual (120 pages) correctly upgraded to text-embedding-3-large (3072 dims)");

  // Test 1.4: High Domain Specificity & Subtle Terminology (e.g. $29/mo vs $29/yr, tiered SLA clauses)
  console.log("1.4 Testing High Domain Specificity & Dense Tabular Nuances...");
  const densePricingTable = `
| Plan Tier | Monthly Billing | Annual Billing | SLA Uptime | Support Level |
|---|---|---|---|---|
| Starter | $29/mo | $290/yr | 99.5% uptime guarantee | Business Hours |
| Enterprise | $199/mo | $1,990/yr | 99.99% uptime guarantee | 24/7 Dedicated |
`;
  const subtleDomainDoc = classifyDocumentTier({
    pageCount: 12, // Short document, but contains dense tables & subtle pricing/SLA nuances
    text: `Contract SLA Addendum:\n${densePricingTable}\nService level agreement with indemnification and liability limitation clauses.`,
    filename: "pricing_sla_addendum.md",
    hasDenseTables: true,
  });
  assert.equal(subtleDomainDoc.tier, "large");
  assert.equal(subtleDomainDoc.model, "text-embedding-3-large");
  assert.equal(subtleDomainDoc.dimension, 3072);
  assert.ok(subtleDomainDoc.reason.includes("High domain specificity & subtle terminology"));
  assert.equal(subtleDomainDoc.detectedSignals.denseTabularMetrics, true);
  assert.equal(subtleDomainDoc.detectedSignals.subtleTerminology, true);
  console.log("   ✓ Subtle domain terms & pricing tables correctly upgraded to text-embedding-3-large");

  // Test 1.5: Dimension-Segregated Vector Namespaces
  console.log("1.5 Testing Dimension-Segregated Vector Namespaces...");
  const smallNamespace = getTieredNamespace("org_acme_corp", "small");
  const largeNamespace = getTieredNamespace("org_acme_corp", "large");

  assert.equal(smallNamespace, "org_acme_corp");
  assert.equal(largeNamespace, "org_acme_corp:large");
  assert.notEqual(smallNamespace, largeNamespace, "Namespaces must be strictly segregated by dimension");
  console.log("   ✓ Namespaces segregated cleanly: 'org_acme_corp' vs 'org_acme_corp:large'");

  // =========================================================================
  // Part 2: Ephemeral HMAC-SHA256 Signed Session Token Tests
  // =========================================================================
  console.log("\n--- Part 2: Testing Ephemeral HMAC-SHA256 Cryptographic Session Security ---");

  const testSecret = "test-session-hmac-sha256-signing-secret-key-32b";
  const now = Date.now();
  const validExp = now + 24 * 60 * 60 * 1000; // 24 hours

  // Test 2.1: Valid token generation and verification
  console.log("2.1 Testing Valid Session Token Generation & Verification...");
  const validToken = await createSignedSessionToken(
    {
      sessionId: "sess_cs_9482710491",
      orgId: "org_customer_aivon",
      exp: validExp,
    },
    testSecret
  );

  assert.ok(validToken.startsWith("ast_v1."));
  const verifyResult = await verifySignedSessionToken(
    validToken,
    "org_customer_aivon",
    testSecret
  );

  assert.equal(verifyResult.valid, true);
  assert.equal(verifyResult.payload?.sessionId, "sess_cs_9482710491");
  assert.equal(verifyResult.payload?.orgId, "org_customer_aivon");
  assert.equal(verifyResult.payload?.exp, validExp);
  console.log("   ✓ Valid HMAC-SHA256 session token verified successfully");

  // Test 2.2: Cryptographic Tamper-Proofing (tampered sessionId, orgId, or exp)
  console.log("2.2 Testing Cryptographic Tamper-Proofing & Signature Forgery Detection...");
  const parts = validToken.split(".");
  // Tamper the payload: replace base64url payload with a forged sessionId
  const forgedPayload = Buffer.from(
    JSON.stringify({
      sessionId: "sess_cs_ATTACKER_TARGET",
      orgId: "org_customer_aivon",
      exp: validExp,
    })
  ).toString("base64url");
  const tamperedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

  const tamperedResult = await verifySignedSessionToken(
    tamperedToken,
    "org_customer_aivon",
    testSecret
  );
  assert.equal(tamperedResult.valid, false);
  assert.ok(tamperedResult.reason?.includes("tampered token"));
  console.log("   ✓ Tampered payload detected and rejected with signature verification failure");

  // Test 2.3: Tampered signature bits
  const tamperedSigToken = `${parts[0]}.${parts[1]}.ff${parts[2]?.slice(2)}`;
  const tamperedSigResult = await verifySignedSessionToken(
    tamperedSigToken,
    "org_customer_aivon",
    testSecret
  );
  assert.equal(tamperedSigResult.valid, false);
  console.log("   ✓ Forged signature rejected");

  // Test 2.4: Cross-Tenant Session Hijacking Prevention
  console.log("2.4 Testing Cross-Tenant Session Hijacking Defense...");
  const crossTenantResult = await verifySignedSessionToken(
    validToken,
    "org_victim_tenant", // Expected tenant is different from token tenant
    testSecret
  );
  assert.equal(crossTenantResult.valid, false);
  assert.ok(crossTenantResult.reason?.includes("Token organization mismatch"));
  console.log("   ✓ Cross-tenant session token substitution strictly blocked");

  // Test 2.5: Expired Token Rejection
  console.log("2.5 Testing Automatic Rejection of Expired Session Tokens...");
  const expiredToken = await createSignedSessionToken(
    {
      sessionId: "sess_expired_1",
      orgId: "org_customer_aivon",
      exp: now - 1000, // Expired 1 second ago
    },
    testSecret
  );

  const expiredResult = await verifySignedSessionToken(
    expiredToken,
    "org_customer_aivon",
    testSecret
  );
  assert.equal(expiredResult.valid, false);
  assert.ok(expiredResult.reason?.includes("expired"));
  console.log("   ✓ Expired session token rejected");

  // Test 2.6: Malformed Token Rejection
  console.log("2.6 Testing Malformed Token Rejection...");
  assert.equal((await verifySignedSessionToken("random_junk_token")).valid, false);
  assert.equal((await verifySignedSessionToken("ast_v1.not_valid_json.signature")).valid, false);
  console.log("   ✓ Malformed tokens safely rejected");

  console.log("\n=========================================================================");
  console.log("✅ All Adaptive Document Tiering & Session Security Tests Passed (100%)!");
  console.log("=========================================================================\n");
}

runAdaptiveTieringAndSessionSecurityTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
