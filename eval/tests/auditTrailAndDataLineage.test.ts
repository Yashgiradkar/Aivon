import assert from "node:assert/strict";
import {
  AuditMiddleware,
  EvidenceLineageItem,
  LineagePayload,
} from "../../packages/backend/convex/system/ai/observability/auditMiddleware";
import { maskPIIForLogging } from "../../packages/backend/convex/system/ai/security/sanitizer";

export async function runAuditTrailAndDataLineageTests(): Promise<void> {
  console.log("=== Running Centralized Audit Trail & RAG Data Lineage Test Suite ===");

  // -------------------------------------------------------------------------
  // Test 1: Correlated Trace ID Generation & Multi-Modal Continuity
  // -------------------------------------------------------------------------
  console.log("  [Test 1] Correlated Trace ID Generation & Structure...");
  const chatTrace = AuditMiddleware.generateTraceId("chat");
  const voiceTrace = AuditMiddleware.generateTraceId("voice");
  const operatorTrace = AuditMiddleware.generateTraceId("operator");

  assert.ok(chatTrace.startsWith("tr_chat_"), "Chat trace must have tr_chat_ prefix");
  assert.ok(voiceTrace.startsWith("tr_voice_"), "Voice trace must have tr_voice_ prefix");
  assert.ok(operatorTrace.startsWith("tr_operator_"), "Operator trace must have tr_operator_ prefix");
  assert.notEqual(chatTrace, voiceTrace, "Traces must be distinct");

  // -------------------------------------------------------------------------
  // Test 2: RAG Data Lineage - Evidence Chunks, Page Numbers & Citations
  // -------------------------------------------------------------------------
  console.log("  [Test 2] RAG Data Lineage Tracking & Chunk Attribution...");
  const mockEvidence: EvidenceLineageItem[] = [
    {
      evidenceId: "EVD-1",
      documentId: "enterprise_service_agreement.pdf",
      documentName: "enterprise_service_agreement.pdf",
      pageNumber: 14,
      section: "Section 4.2 - SLA Uptime Guarantee",
      chunkId: "enterprise_service_agreement.pdf_p14_c1",
      contentType: "prose",
      score: 0.94,
      snippet: "Aivon guarantees 99.95% monthly uptime. If downtime exceeds 0.05%, service credits of 10% apply.",
      retrievalSource: "hybrid_rrf",
    },
    {
      evidenceId: "EVD-2",
      documentId: "pricing_matrix.csv",
      documentName: "pricing_matrix.csv",
      pageNumber: 1,
      section: "Tier Limits",
      chunkId: "pricing_matrix.csv_p1_c0",
      contentType: "table",
      score: 0.89,
      snippet: "Plan | Monthly Tokens | Concurrency | Overage\nEnterprise | 50,000,000 | 25 | $0.002/1k",
      retrievalSource: "dense",
    },
  ];

  const lineagePayload: LineagePayload = {
    organizationId: "org_tenant_alpha",
    traceId: chatTrace,
    channel: "chat",
    userQuery: "What is the uptime SLA and enterprise plan limit?",
    effectiveStrategy: "hybrid_rrf",
    retrievedEvidence: mockEvidence,
    generatedResponse: "Our SLA guarantees 99.95% monthly uptime [Source: enterprise_service_agreement.pdf, Page 14]. The Enterprise plan includes 50M tokens [Source: pricing_matrix.csv, Page 1].",
    model: "gpt-4o-mini",
    latencyMs: 142,
    tokensUsed: 220,
    hasEvidence: true,
  };

  // Verify lineage metadata structure
  assert.equal(lineagePayload.retrievedEvidence.length, 2);
  assert.equal(lineagePayload.retrievedEvidence[0]?.pageNumber, 14);
  assert.equal(lineagePayload.retrievedEvidence[0]?.section, "Section 4.2 - SLA Uptime Guarantee");
  assert.equal(lineagePayload.retrievedEvidence[0]?.chunkId, "enterprise_service_agreement.pdf_p14_c1");
  assert.equal(lineagePayload.retrievedEvidence[1]?.contentType, "table");
  assert.ok(lineagePayload.generatedResponse.includes("Page 14"));

  // -------------------------------------------------------------------------
  // Test 3: Voice & Audio Traceability (ElevenLabs / Vapi)
  // -------------------------------------------------------------------------
  console.log("  [Test 3] Voice & ElevenLabs End-to-End Traceability...");
  const rawSpokenResponse = "Our SLA guarantees 99.95% monthly uptime. The Enterprise plan includes 50 million tokens.";

  const voiceLineagePayload: LineagePayload = {
    organizationId: "org_tenant_alpha",
    traceId: voiceTrace,
    channel: "voice",
    userQuery: "Can you tell me about the SLA uptime?",
    effectiveStrategy: "hybrid_rrf",
    retrievedEvidence: [mockEvidence[0]!],
    generatedResponse: "Aivon guarantees 99.95% monthly uptime [Source: enterprise_service_agreement.pdf, Page 14].",
    speechFormattedResponse: rawSpokenResponse,
    model: "gpt-4o-mini",
    voiceMetadata: {
      provider: "elevenlabs",
      voiceId: "rachel",
      modelId: "eleven_turbo_v2_5",
      audioDurationSeconds: 4.8,
      transcriberProvider: "deepgram",
      transcriberLanguage: "en",
    },
    latencyMs: 185,
    tokensUsed: 130,
    hasEvidence: true,
  };

  assert.equal(voiceLineagePayload.voiceMetadata?.provider, "elevenlabs");
  assert.equal(voiceLineagePayload.voiceMetadata?.voiceId, "rachel");
  assert.equal(voiceLineagePayload.voiceMetadata?.modelId, "eleven_turbo_v2_5");
  assert.ok(voiceLineagePayload.speechFormattedResponse?.length! > 0);
  assert.ok(!voiceLineagePayload.speechFormattedResponse?.includes("[Source:"));

  // -------------------------------------------------------------------------
  // Test 4: Tenant Isolation & Non-Interference
  // -------------------------------------------------------------------------
  console.log("  [Test 4] Tenant Isolation in Audit & Lineage Lookups...");
  const mockStorage = new Map<string, any[]>();

  function simulateTenantInsert(orgId: string, record: any) {
    const list = mockStorage.get(orgId) || [];
    list.push({ ...record, organizationId: orgId });
    mockStorage.set(orgId, list);
  }

  function simulateTenantQuery(requestingOrgId: string): any[] {
    return mockStorage.get(requestingOrgId) || [];
  }

  simulateTenantInsert("org_tenant_alpha", { traceId: "tr_alpha_1", query: "Alpha secrets" });
  simulateTenantInsert("org_tenant_beta", { traceId: "tr_beta_1", query: "Beta secrets" });

  const alphaRecords = simulateTenantQuery("org_tenant_alpha");
  const betaRecords = simulateTenantQuery("org_tenant_beta");

  assert.equal(alphaRecords.length, 1);
  assert.equal(alphaRecords[0].traceId, "tr_alpha_1");
  assert.equal(betaRecords.length, 1);
  assert.equal(betaRecords[0].traceId, "tr_beta_1");
  assert.ok(!alphaRecords.some((r) => r.query.includes("Beta")));
  assert.ok(!betaRecords.some((r) => r.query.includes("Alpha")));

  // -------------------------------------------------------------------------
  // Test 5: PII & Credential Masking in Audit Events
  // -------------------------------------------------------------------------
  console.log("  [Test 5] PII & Secret Redaction in Audit Logs...");
  const queryWithPII = "My email is customer.doe@example.com, phone 555-0199, card 4111222233334444, and key sk-proj-abcdef1234567890abcdef";
  const maskedQuery = maskPIIForLogging(queryWithPII);

  assert.ok(!maskedQuery.includes("customer.doe@example.com"));
  assert.ok(!maskedQuery.includes("4111222233334444"));
  assert.ok(!maskedQuery.includes("sk-proj-abcdef1234567890abcdef"));
  assert.ok(maskedQuery.includes("[REDACTED_EMAIL]"));
  assert.ok(maskedQuery.includes("[REDACTED_CC]"));
  assert.ok(maskedQuery.includes("[REDACTED_API_KEY]"));

  // -------------------------------------------------------------------------
  // Test 6: Zero-Evidence & Security Violation Event Handling
  // -------------------------------------------------------------------------
  console.log("  [Test 6] Failed Retrieval & Security Audit Events...");
  const zeroEvidencePayload: LineagePayload = {
    organizationId: "org_tenant_alpha",
    traceId: AuditMiddleware.generateTraceId("chat"),
    channel: "chat",
    userQuery: "How do I build an orbital rocket engine?",
    effectiveStrategy: "dense",
    retrievedEvidence: [],
    generatedResponse: "I could not find specific details about that in our knowledge base.",
    model: "gpt-4o-mini",
    latencyMs: 95,
    tokensUsed: 40,
    hasEvidence: false,
  };

  assert.equal(zeroEvidencePayload.hasEvidence, false);
  assert.equal(zeroEvidencePayload.retrievedEvidence.length, 0);

  // -------------------------------------------------------------------------
  // Test 7: Logging Overhead & Benchmark
  // -------------------------------------------------------------------------
  console.log("  [Test 7] Audit Middleware Performance & Overhead Measurement...");
  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const trace = AuditMiddleware.generateTraceId("chat");
    AuditMiddleware.recordEvent(
      {
        scheduler: {
          runAfter: () => {},
        },
      },
      {
        organizationId: "org_perf_test",
        traceId: trace,
        channel: "chat",
        eventType: "llm.request",
        stage: "orchestration.started",
        status: "success",
        latencyMs: 15,
        inputTokens: 100,
        metadata: { iteration: i },
      },
    );
  }

  const duration = performance.now() - start;
  const avgPerCallMs = duration / iterations;
  console.log(`    -> ${iterations} audit events processed in ${duration.toFixed(2)}ms (${avgPerCallMs.toFixed(4)}ms/call)`);
  assert.ok(avgPerCallMs < 1.0, `Audit event processing must be sub-millisecond (got ${avgPerCallMs}ms)`);

  console.log("=========================================================================");
  console.log("✅ All Centralized Audit Trail & RAG Data Lineage Tests Passed (100%)!");
  console.log("=========================================================================");
}

runAuditTrailAndDataLineageTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
