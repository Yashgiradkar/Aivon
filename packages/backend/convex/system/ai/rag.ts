import { openai } from "@ai-sdk/openai";
import { RAG } from "@convex-dev/rag";
import { components } from "../../_generated/api";

/**
 * Standard RAG Instance (1536-dimensional text-embedding-3-small)
 * Defaults to cost-effective embedding generation for documents <= 50 pages.
 */
const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
});

export default rag;

// Export Adaptive Document Tiering logic, criteria, and namespace helpers
export * from "./rag/adaptiveTiering";
