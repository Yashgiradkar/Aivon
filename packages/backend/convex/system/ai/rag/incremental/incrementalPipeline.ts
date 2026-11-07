import { Value } from "convex/values";
import {
  DocumentManifest,
  EmbeddingProviderFn,
  IncrementalUpdateOptions,
  IncrementalUpdateResult,
  StructuredChunk,
} from "./types";
import { computeContentHash, PageSplitter } from "./pageSplitter";
import { StructureChunker } from "./structureChunker";
import { ChunkEmbeddingCache } from "./chunkEmbeddingCache";
import { DocumentManifestStore } from "./manifestStore";
import { DiffEngine } from "./diffEngine";
import { TenantBM25Cache } from "../bm25";
import { MultiTenantRetrievalCache } from "../../cache/retrievalCache";

/**
 * Default production embedding provider utilizing OpenAI text-embedding-3-small.
 */
async function defaultOpenAIEmbeddingProvider(texts: string[]): Promise<number[][]> {
  const { embedMany } = await import("ai");
  const { openai } = await import("@ai-sdk/openai");
  const model = openai.embedding("text-embedding-3-small");
  const results: number[][] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model,
      values: batch,
    });
    results.push(...embeddings);
  }

  return results;
}

/**
 * End-to-End Incremental RAG Document Update Pipeline.
 *
 * Core Guarantees:
 * 1. Precision Change Detection: Page & section level SHA-256 diffing.
 * 2. Zero-Cost Preservation: Unchanged pages and chunks are NEVER re-embedded.
 * 3. Minimal Token & API Consumption: Only genuinely new or modified chunks trigger embedding calls.
 * 4. Stale Vector Cleanup: Removed or replaced chunks are immediately unindexed.
 * 5. Tenant Isolation: All caches, manifests, and vectors are strictly scoped by organizationId.
 */
export class IncrementalRAGPipeline {
  /**
   * Processes a document (initial upload or revision update) through the incremental pipeline.
   */
  static async processDocument(
    rawText: string,
    options: IncrementalUpdateOptions,
  ): Promise<IncrementalUpdateResult> {
    const startTime = Date.now();
    const { organizationId, documentKey, filename } = options;

    // 1. Segment document into discrete, stable PageUnits
    const pages = PageSplitter.splitDocument(rawText, filename);
    const documentHash = computeContentHash(rawText);

    // 2. Fetch previous revision manifest
    const oldManifest = DocumentManifestStore.get(organizationId, documentKey);

    // 3. Compute granular page-level diff
    const diff = DiffEngine.computeDiff(oldManifest, pages, documentKey);

    // 4. Structure-aware chunking & cache-aware embedding reuse
    const allChunks: StructuredChunk[] = [];
    const missingChunksToEmbed: StructuredChunk[] = [];
    let reusedEmbeddingsCount = 0;

    for (const page of pages) {
      // Chunk page with structure preservation (tables, code, headers)
      const pageChunks = StructureChunker.chunkPage(page, documentKey, {
        maxChunkSize: options.targetChunkSize ?? 1800,
        overlapSize: options.chunkOverlap ?? 200,
      });

      for (const chunk of pageChunks) {
        // Check if embedding exists in content-addressable cache
        const cachedEmbedding = ChunkEmbeddingCache.get(organizationId, chunk.chunkHash);

        if (cachedEmbedding) {
          chunk.embedding = cachedEmbedding;
          reusedEmbeddingsCount++;
        } else {
          missingChunksToEmbed.push(chunk);
        }

        allChunks.push(chunk);
      }
    }

    // 5. Generate embeddings ONLY for missing/modified chunks
    let newEmbeddingsGenerated = 0;
    let embeddingApiCalls = 0;
    let tokensConsumed = 0;

    if (missingChunksToEmbed.length > 0 && !options.dryRun) {
      const embeddingProvider: EmbeddingProviderFn =
        options.embeddingProvider ?? defaultOpenAIEmbeddingProvider;

      // Estimate tokens (~4 characters per token for English text)
      tokensConsumed = missingChunksToEmbed.reduce(
        (sum, c) => sum + Math.ceil(c.text.length / 4),
        0,
      );

      const textsToEmbed = missingChunksToEmbed.map((c) => c.text);
      const BATCH_SIZE = 100;
      embeddingApiCalls = Math.ceil(textsToEmbed.length / BATCH_SIZE);

      const vectors = await embeddingProvider(textsToEmbed);

      if (vectors.length !== missingChunksToEmbed.length) {
        throw new Error(
          `Embedding provider returned ${vectors.length} vectors for ${missingChunksToEmbed.length} chunks.`,
        );
      }

      // Assign embeddings and populate content-addressable cache
      for (let i = 0; i < missingChunksToEmbed.length; i++) {
        const chunk = missingChunksToEmbed[i];
        const vector = vectors[i];
        chunk.embedding = vector;
        ChunkEmbeddingCache.set(organizationId, chunk.chunkHash, vector);
        newEmbeddingsGenerated++;
      }
    }

    // 6. Build and persist updated DocumentManifest
    const newManifest: DocumentManifest = {
      documentKey,
      organizationId,
      version: (oldManifest?.version ?? 0) + 1,
      documentHash,
      totalPages: pages.length,
      totalChunks: allChunks.length,
      updatedAt: Date.now(),
      pages: pages.map((page) => {
        const pageChunkHashes = allChunks
          .filter((c) => c.pageNumber === page.pageNumber)
          .map((c) => c.chunkHash);
        return {
          pageNumber: page.pageNumber,
          pageHash: page.pageHash,
          chunkHashes: pageChunkHashes,
        };
      }),
    };

    DocumentManifestStore.save(newManifest);

    // 7. Prune stale embeddings no longer referenced by any active document in tenant
    const activeHashes = DocumentManifestStore.getActiveChunkHashes(organizationId);
    const staleChunksPruned = ChunkEmbeddingCache.pruneStale(organizationId, activeHashes);

    // 8. Invalidate tenant lexical (BM25) and semantic retrieval caches
    TenantBM25Cache.invalidate(organizationId);
    MultiTenantRetrievalCache.invalidateOrg(organizationId);

    const processingTimeMs = Date.now() - startTime;

    return {
      documentKey,
      organizationId,
      version: newManifest.version,
      documentHash,
      totalPages: pages.length,
      totalChunks: allChunks.length,
      diff,
      reusedChunksCount: reusedEmbeddingsCount,
      newChunksCount: missingChunksToEmbed.length,
      reusedEmbeddingsCount,
      newEmbeddingsGenerated,
      embeddingApiCalls,
      tokensConsumed,
      processingTimeMs,
      chunks: allChunks,
      staleChunksPruned,
    };
  }

  /**
   * Transforms StructuredChunks into InputChunk format suitable for rag.add().
   * Pre-populates embeddings on every chunk so @convex-dev/rag skips embedMany completely.
   */
  static toRAGInputChunks(chunks: StructuredChunk[]): Array<{
    id: string;
    pageContent: string;
    metadata: Record<string, Value>;
    embedding?: number[];
  }> {
    return chunks.map((c) => {
      const metadata: Record<string, Value> = {
        documentKey: c.documentKey,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        chunkHash: c.chunkHash,
        isTable: c.isTable ?? false,
      };
      if (c.section) metadata.section = c.section;
      if (c.headingPath && c.headingPath.length > 0) {
        metadata.headingPath = c.headingPath;
      }
      return {
        id: c.id,
        pageContent: c.text,
        metadata,
        embedding: c.embedding,
      };
    });
  }
}
