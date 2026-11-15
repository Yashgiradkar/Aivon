import assert from "node:assert/strict";
import {
  PageSplitter,
  computeContentHash,
} from "../../packages/backend/convex/system/ai/rag/incremental/pageSplitter";
import {
  StructureChunker,
} from "../../packages/backend/convex/system/ai/rag/incremental/structureChunker";
import {
  ChunkEmbeddingCache,
} from "../../packages/backend/convex/system/ai/rag/incremental/chunkEmbeddingCache";
import {
  DocumentManifestStore,
} from "../../packages/backend/convex/system/ai/rag/incremental/manifestStore";
import {
  DiffEngine,
} from "../../packages/backend/convex/system/ai/rag/incremental/diffEngine";
import {
  IncrementalRAGPipeline,
} from "../../packages/backend/convex/system/ai/rag/incremental/incrementalPipeline";
import { BM25Index } from "../../packages/backend/convex/system/ai/rag/bm25";

/**
 * Deterministic mock embedding provider for tests and benchmarks.
 * Generates reproducible 1536-dimensional normalized vectors from text hashes.
 */
function createDeterministicMockEmbeddingProvider(tracker?: { calls: number; textsEmbedded: string[] }) {
  return async (texts: string[]): Promise<number[][]> => {
    if (tracker) {
      tracker.calls++;
      tracker.textsEmbedded.push(...texts);
    }

    return texts.map((text) => {
      const hash = computeContentHash(text);
      const vector = new Array<number>(1536).fill(0);
      for (let i = 0; i < 32; i++) {
        const val = parseInt(hash.slice(i * 2, i * 2 + 2), 16) / 255;
        vector[i] = val;
      }
      // Normalize
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
      return vector.map((v) => v / norm);
    });
  };
}

export async function runIncrementalRAGTests(): Promise<void> {
  console.log("=== Running Incremental RAG Document Update Pipeline Tests ===");

  // Reset in-memory test states
  ChunkEmbeddingCache.clear();
  DocumentManifestStore.clear();

  const orgId = "org_test_incremental_1";
  const docKey = "enterprise_handbook.md";

  // -------------------------------------------------------------------------
  // Test 1: Page-Aware Document Splitting
  // -------------------------------------------------------------------------
  console.log("  [Test 1] Page-aware and structure-aware document splitting...");

  // 1a. Form Feed splitting
  const ffDoc = "Page 1 Content\fPage 2 Content\fPage 3 Content";
  const ffPages = PageSplitter.splitDocument(ffDoc, "doc.pdf");
  assert.equal(ffPages.length, 3);
  assert.equal(ffPages[0].pageNumber, 1);
  assert.equal(ffPages[0].text, "Page 1 Content");
  assert.equal(ffPages[2].pageNumber, 3);
  assert.equal(ffPages[2].text, "Page 3 Content");

  // 1b. Explicit page markers
  const markerDoc = `--- [Page 1] ---
Introduction to Cloud Infrastructure.
--- [Page 2] ---
Security and Compliance Policies.`;
  const markerPages = PageSplitter.splitDocument(markerDoc, "cloud.md");
  assert.equal(markerPages.length, 2);
  assert.equal(markerPages[0].pageNumber, 1);
  assert.ok(markerPages[0].text.includes("Introduction to Cloud"));
  assert.equal(markerPages[1].pageNumber, 2);
  assert.ok(markerPages[1].text.includes("Security and Compliance"));

  // 1c. Markdown horizontal rule breaks
  const hrDoc = "Section Alpha\n\n---\n\nSection Beta\n\n---\n\nSection Gamma";
  const hrPages = PageSplitter.splitDocument(hrDoc, "sections.md");
  assert.equal(hrPages.length, 3);
  assert.equal(hrPages[0].text, "Section Alpha");
  assert.equal(hrPages[1].text, "Section Beta");

  // 1d. Headings split
  const headingDoc = "# Service Overview\nDetails here.\n\n# SLA Guarantee\n99.99% uptime.\n\n# Contact Support\nCall 555-0199.";
  const headingPages = PageSplitter.splitDocument(headingDoc, "overview.md");
  assert.equal(headingPages.length, 3);
  assert.equal(headingPages[0].title, "Service Overview");
  assert.equal(headingPages[1].title, "SLA Guarantee");

  console.log("    ✓ Form feed, page markers, horizontal rules, and headings cleanly segmented.");

  // -------------------------------------------------------------------------
  // Test 2: Structure-Aware Chunking (Table & Heading Context Preservation)
  // -------------------------------------------------------------------------
  console.log("  [Test 2] Structure-aware chunking with table and heading integrity...");

  const tablePage = {
    pageNumber: 4,
    pageId: "p_4",
    title: "Pricing Guide",
    text: `## Tier Comparison

Here is our plan breakdown:

| Plan | Price ($) | Support Response | Seats |
| --- | --- | --- | --- |
| Basic | 29 | 24 hours | 5 |
| Pro | 99 | 4 hours | 20 |
| Enterprise | 299 | 15 minutes | Unlimited |

All plans include 2FA authentication and automated backups.`,
    pageHash: "hash_p4",
  };

  const chunks = StructureChunker.chunkPage(tablePage, "pricing.md");
  assert.ok(chunks.length >= 1);
  const tableChunk = chunks.find((c) => c.isTable);
  assert.ok(tableChunk !== undefined, "Table must be recognized and flagged");
  assert.ok(tableChunk.text.includes("| Enterprise | 299 | 15 minutes | Unlimited |"));
  assert.equal(tableChunk.pageNumber, 4);
  assert.equal(tableChunk.id, `pricing.md_p4_c${tableChunk.chunkIndex}`);
  assert.ok(tableChunk.chunkHash.length === 64, "Chunk hash must be 64-char SHA-256");

  console.log("    ✓ Tables preserved without row slicing; stable identifiers generated.");

  // -------------------------------------------------------------------------
  // Test 3: Multi-Tenant Content-Addressable Chunk Embedding Cache
  // -------------------------------------------------------------------------
  console.log("  [Test 3] Multi-tenant chunk embedding cache & tenant isolation...");

  const testHash = computeContentHash("Refunds are processed within 5 business days.");
  const mockVectorA = [0.1, 0.2, 0.3];
  const mockVectorB = [0.9, 0.8, 0.7];

  ChunkEmbeddingCache.set("org_alpha", testHash, mockVectorA);
  ChunkEmbeddingCache.set("org_beta", testHash, mockVectorB);

  // Strict tenant isolation verification
  assert.deepEqual(ChunkEmbeddingCache.get("org_alpha", testHash), mockVectorA);
  assert.deepEqual(ChunkEmbeddingCache.get("org_beta", testHash), mockVectorB);
  assert.equal(ChunkEmbeddingCache.get("org_gamma", testHash), undefined);

  // Batch lookup
  const batchRes = ChunkEmbeddingCache.getBatch("org_alpha", [testHash, "non_existent_hash"]);
  assert.equal(batchRes.cached.size, 1);
  assert.equal(batchRes.missing.length, 1);
  assert.equal(batchRes.missing[0], "non_existent_hash");

  console.log("    ✓ Multi-tenant keying ensures 0% cross-tenant cache leakage.");

  // -------------------------------------------------------------------------
  // Test 4: Fine-Grained Diff Detection
  // -------------------------------------------------------------------------
  console.log("  [Test 4] DiffEngine change detection across revisions...");

  const oldManifest = {
    documentKey: "policy.md",
    organizationId: orgId,
    version: 1,
    documentHash: "hash_doc_v1",
    totalPages: 3,
    totalChunks: 3,
    updatedAt: Date.now(),
    pages: [
      { pageNumber: 1, pageHash: "hash_p1", chunkHashes: ["c1"] },
      { pageNumber: 2, pageHash: "hash_p2", chunkHashes: ["c2"] },
      { pageNumber: 3, pageHash: "hash_p3", chunkHashes: ["c3"] },
    ],
  };

  // Case A: Page 2 modified, Page 1 and 3 unchanged
  const newPagesA = [
    { pageNumber: 1, pageId: "p_1", text: "Page 1", pageHash: "hash_p1" },
    { pageNumber: 2, pageId: "p_2", text: "Page 2 modified", pageHash: "hash_p2_MODIFIED" },
    { pageNumber: 3, pageId: "p_3", text: "Page 3", pageHash: "hash_p3" },
  ];
  const diffA = DiffEngine.computeDiff(oldManifest, newPagesA, "policy.md");
  assert.deepEqual(diffA.unchangedPages, [1, 3]);
  assert.deepEqual(diffA.modifiedPages, [2]);
  assert.equal(diffA.addedPages.length, 0);
  assert.equal(diffA.deletedPages.length, 0);

  // Case B: Page 4 added (page insertion)
  const newPagesB = [
    ...newPagesA,
    { pageNumber: 4, pageId: "p_4", text: "Page 4 Added", pageHash: "hash_p4" },
  ];
  const diffB = DiffEngine.computeDiff(oldManifest, newPagesB, "policy.md");
  assert.deepEqual(diffB.addedPages, [4]);

  // Case C: Page 3 deleted
  const newPagesC = [
    { pageNumber: 1, pageId: "p_1", text: "Page 1", pageHash: "hash_p1" },
    { pageNumber: 2, pageId: "p_2", text: "Page 2", pageHash: "hash_p2" },
  ];
  const diffC = DiffEngine.computeDiff(oldManifest, newPagesC, "policy.md");
  assert.deepEqual(diffC.deletedPages, [3]);

  // Case D: Page reordering (page 2 swapped with page 3)
  const newPagesD = [
    { pageNumber: 1, pageId: "p_1", text: "Page 1", pageHash: "hash_p1" },
    { pageNumber: 2, pageId: "p_2", text: "Page 3", pageHash: "hash_p3" },
    { pageNumber: 3, pageId: "p_3", text: "Page 2", pageHash: "hash_p2" },
  ];
  const diffD = DiffEngine.computeDiff(oldManifest, newPagesD, "policy.md");
  assert.equal(diffD.reorderedPages.length, 2);

  console.log("    ✓ Exact isolation of unchanged, modified, added, deleted, and reordered pages.");

  // -------------------------------------------------------------------------
  // Test 5: The 1,000-Page Document Benchmark
  // -------------------------------------------------------------------------
  console.log("\n  [Test 5] Running 1,000-Page Document Benchmark (Single Page Update)...");

  // Construct a realistic 1,000-page document
  const generate1000PageDoc = (modifiedPageNumber?: number, modifiedContent?: string): string => {
    const pages: string[] = [];
    for (let p = 1; p <= 1000; p++) {
      if (p === modifiedPageNumber && modifiedContent) {
        pages.push(
          `--- [Page ${p}] ---\n# Standard Operating Procedure - Page ${p}\n\n${modifiedContent}`
        );
      } else {
        pages.push(
          `--- [Page ${p}] ---\n# Standard Operating Procedure - Page ${p}\n\n` +
          `Section ${p}.1: Operational Guidelines for Node ${p}.\n` +
          `All system operators must follow standard procedure SOP-${p}00.\n` +
          `Downtime window for Node ${p} is strictly scheduled during weekly maintenance at 03:00 UTC.\n` +
          `For emergency escalations on cluster ${p}, contact on-call tier 3 support.`
        );
      }
    }
    return pages.join("\n\n");
  };

  const docV1 = generate1000PageDoc();

  // Step 1: Initial indexing of all 1,000 pages
  const trackerV1 = { calls: 0, textsEmbedded: [] as string[] };
  const mockEmbedderV1 = createDeterministicMockEmbeddingProvider(trackerV1);

  console.log("    -> Performing initial ingestion of 1,000-page document...");
  const t0 = Date.now();
  const resultV1 = await IncrementalRAGPipeline.processDocument(docV1, {
    organizationId: orgId,
    documentKey: docKey,
    filename: docKey,
    mimeType: "text/markdown",
    embeddingProvider: mockEmbedderV1,
  });
  const initialDurationMs = Date.now() - t0;

  console.log(`       Initial Ingestion Complete in ${initialDurationMs}ms:`);
  console.log(`       - Total Pages: ${resultV1.totalPages}`);
  console.log(`       - Total Chunks: ${resultV1.totalChunks}`);
  console.log(`       - Embeddings Generated: ${resultV1.newEmbeddingsGenerated}`);
  console.log(`       - Embedding API Calls: ${resultV1.embeddingApiCalls}`);
  console.log(`       - Tokens Consumed: ${resultV1.tokensConsumed}`);

  assert.equal(resultV1.totalPages, 1000);
  assert.ok(resultV1.totalChunks >= 1000);
  assert.equal(resultV1.reusedEmbeddingsCount, 0, "Initial run has no prior cache");
  assert.equal(resultV1.newEmbeddingsGenerated, resultV1.totalChunks);

  // Step 2: Modify ONLY Page 742 (out of 1,000 pages)
  console.log("\n    -> Modifying Page 742 (refund policy amended from 14 days to 60 days)...");
  const updatedPage742Text =
    "CRITICAL AMENDMENT: The commercial refund SLA on Page 742 is officially extended to 60 calendar days with zero restocking fee.";
  const docV2 = generate1000PageDoc(742, updatedPage742Text);

  const trackerV2 = { calls: 0, textsEmbedded: [] as string[] };
  const mockEmbedderV2 = createDeterministicMockEmbeddingProvider(trackerV2);

  const t1 = Date.now();
  const resultV2 = await IncrementalRAGPipeline.processDocument(docV2, {
    organizationId: orgId,
    documentKey: docKey,
    filename: docKey,
    mimeType: "text/markdown",
    embeddingProvider: mockEmbedderV2,
  });
  const incrementalDurationMs = Date.now() - t1;

  console.log(`       Incremental Update Complete in ${incrementalDurationMs}ms:`);
  console.log(`       - Total Pages: ${resultV2.totalPages}`);
  console.log(`       - Unchanged Pages: ${resultV2.diff.unchangedPages.length} (99.9%)`);
  console.log(`       - Modified Pages: ${resultV2.diff.modifiedPages} (Page 742)`);
  console.log(`       - Reused Embeddings: ${resultV2.reusedEmbeddingsCount}`);
  console.log(`       - New Embeddings Generated: ${resultV2.newEmbeddingsGenerated}`);
  console.log(`       - Embedding API Calls: ${resultV2.embeddingApiCalls}`);
  console.log(`       - Tokens Consumed: ${resultV2.tokensConsumed}`);
  console.log(`       - Speedup Ratio: ${(initialDurationMs / Math.max(incrementalDurationMs, 1)).toFixed(1)}x faster`);

  // Verify critical optimization invariants
  assert.equal(resultV2.diff.unchangedPages.length, 999, "999 pages must be recognized as untouched");
  assert.deepEqual(resultV2.diff.modifiedPages, [742], "Only Page 742 must be modified");
  assert.equal(resultV2.reusedEmbeddingsCount, resultV1.totalChunks - 1, "All chunks from 999 pages must be reused");
  assert.equal(resultV2.newEmbeddingsGenerated, 1, "Only the 1 modified chunk on Page 742 must be embedded");
  assert.equal(resultV2.embeddingApiCalls, 1, "Exactly 1 embedding API call made");
  assert.ok(
    resultV2.tokensConsumed < 200,
    `Tokens consumed (${resultV2.tokensConsumed}) must be tiny compared to full document (${resultV1.tokensConsumed})`
  );
  assert.ok(
    resultV2.tokensConsumed < resultV1.tokensConsumed * 0.01,
    "Token reduction must exceed 99%"
  );

  // -------------------------------------------------------------------------
  // Test 6: Retrieval Accuracy & Searchability Verification
  // -------------------------------------------------------------------------
  console.log("\n  [Test 6] Verifying Search Accuracy and Unchanged Content Availability...");

  // Build BM25 index over the chunks returned by resultV2
  const searchIndex = new BM25Index();
  for (const chunk of resultV2.chunks) {
    searchIndex.addDocument({
      id: chunk.id,
      entryId: docKey,
      title: `Page ${chunk.pageNumber}`,
      text: chunk.text,
    });
  }

  // 6a. Search unchanged content on Page 12
  const resPage12 = searchIndex.search("Node 12 maintenance", 3);
  assert.ok(resPage12.length > 0);
  assert.ok(resPage12[0].text.includes("Node 12"));
  assert.equal(resPage12[0].id, "enterprise_handbook.md_p12_c0");

  // 6b. Search unchanged content on Page 500
  const resPage500 = searchIndex.search("Node 500 emergency escalation", 3);
  assert.ok(resPage500.length > 0);
  assert.ok(resPage500[0].text.includes("Node 500"));
  assert.equal(resPage500[0].id, "enterprise_handbook.md_p500_c0");

  // 6c. Search unchanged content on Page 999
  const resPage999 = searchIndex.search("cluster 999", 3);
  assert.ok(resPage999.length > 0);
  assert.ok(resPage999[0].text.includes("Node 999"));
  assert.equal(resPage999[0].id, "enterprise_handbook.md_p999_c0");

  // 6d. Search modified content on Page 742 (new policy)
  const resAmended = searchIndex.search("commercial refund SLA 60 calendar days", 3);
  assert.ok(resAmended.length > 0);
  assert.ok(resAmended[0].text.includes("extended to 60 calendar days"));
  assert.equal(resAmended[0].id, "enterprise_handbook.md_p742_c0");

  console.log("    ✓ Unchanged pages (p12, p500, p999) and amended page (p742) retrieved with 100% precision.");

  // -------------------------------------------------------------------------
  // Test 7: Idempotency & Zero-Operation Re-run
  // -------------------------------------------------------------------------
  console.log("\n  [Test 7] Testing Idempotency on Unchanged Re-upload...");

  const trackerV3 = { calls: 0, textsEmbedded: [] as string[] };
  const mockEmbedderV3 = createDeterministicMockEmbeddingProvider(trackerV3);

  const resultV3 = await IncrementalRAGPipeline.processDocument(docV2, {
    organizationId: orgId,
    documentKey: docKey,
    filename: docKey,
    mimeType: "text/markdown",
    embeddingProvider: mockEmbedderV3,
  });

  assert.equal(resultV3.diff.unchangedPages.length, 1000, "All 1000 pages must be unchanged on re-run");
  assert.equal(resultV3.diff.modifiedPages.length, 0);
  assert.equal(resultV3.newEmbeddingsGenerated, 0, "0 new embeddings generated");
  assert.equal(resultV3.embeddingApiCalls, 0, "0 API calls made");
  assert.equal(resultV3.tokensConsumed, 0, "0 tokens consumed");

  console.log("    ✓ Re-submitting identical document produces 0 embedding calls and 0 token cost.");

  // -------------------------------------------------------------------------
  // Test 8: Format Compatibility for rag.add (InputChunk Transformation)
  // -------------------------------------------------------------------------
  console.log("\n  [Test 8] Format Compatibility for @convex-dev/rag.add()...");

  const ragInputChunks = IncrementalRAGPipeline.toRAGInputChunks(resultV2.chunks.slice(0, 10));
  assert.equal(ragInputChunks.length, 10);
  for (const chunk of ragInputChunks) {
    assert.ok(chunk.id.startsWith("enterprise_handbook.md_"));
    assert.ok(typeof chunk.pageContent === "string");
    assert.ok(Array.isArray(chunk.embedding));
    assert.equal(chunk.embedding.length, 1536);
    assert.ok(chunk.metadata.pageNumber !== undefined);
  }

  console.log("    ✓ Generated chunks strictly adhere to InputChunk with pre-attached embeddings.");

  console.log("\n=======================================================");
  console.log("✅ All Incremental RAG Pipeline Unit & Benchmark Tests Passed (100%)!");
  console.log("=======================================================");
}

runIncrementalRAGTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
