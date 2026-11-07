/**
 * Type definitions for the Incremental RAG Document Update Pipeline.
 */

import { Value } from "convex/values";

export interface PageUnit {
  pageNumber: number; // 1-indexed
  pageId: string; // e.g. "p_1"
  title?: string;
  text: string;
  pageHash: string; // SHA-256 of page content
  startOffset?: number;
  endOffset?: number;
}

export interface StructuredChunk {
  id: string; // Stable ID: `${docKey}_p${pageNumber}_c${chunkIndex}`
  documentKey: string;
  pageNumber: number;
  section?: string;
  headingPath?: string[];
  chunkIndex: number;
  text: string;
  chunkHash: string; // SHA-256 of chunk text
  isTable?: boolean;
  metadata: Record<string, Value>;
  embedding?: number[];
}

export interface DocumentPageManifest {
  pageNumber: number;
  pageHash: string;
  chunkHashes: string[];
}

export interface DocumentManifest {
  documentKey: string;
  organizationId: string;
  version: number;
  documentHash: string;
  totalPages: number;
  totalChunks: number;
  updatedAt: number;
  pages: DocumentPageManifest[];
}

export interface DocumentDiffResult {
  documentKey: string;
  totalOldPages: number;
  totalNewPages: number;
  unchangedPages: number[];
  modifiedPages: number[];
  addedPages: number[];
  deletedPages: number[];
  reorderedPages: Array<{ oldPage: number; newPage: number }>;
  isFullReplacement: boolean;
  unchangedRatio: number;
}

export type EmbeddingProviderFn = (
  texts: string[],
) => Promise<Array<number[]>>;

export interface IncrementalUpdateOptions {
  organizationId: string;
  documentKey: string;
  filename: string;
  mimeType: string;
  targetChunkSize?: number;
  chunkOverlap?: number;
  embeddingProvider?: EmbeddingProviderFn;
  dryRun?: boolean;
}

export interface IncrementalUpdateResult {
  documentKey: string;
  organizationId: string;
  version: number;
  documentHash: string;
  totalPages: number;
  totalChunks: number;
  diff: DocumentDiffResult;
  reusedChunksCount: number;
  newChunksCount: number;
  reusedEmbeddingsCount: number;
  newEmbeddingsGenerated: number;
  embeddingApiCalls: number;
  tokensConsumed: number;
  processingTimeMs: number;
  chunks: StructuredChunk[];
  staleChunksPruned: number;
}
