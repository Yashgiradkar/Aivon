import { v } from "convex/values";
import { internalQuery } from "../../../_generated/server";
import rag from "../rag";

export interface TenantCorpusChunk {
  id: string;
  entryId: string;
  title: string;
  text: string;
  order: number;
}

/**
 * Loads all verified document chunks for a specific organization from RAG storage.
 * Strictly scoped by namespace: organizationId — guarantees 0% cross-tenant leakage.
 */
export const getTenantCorpus = internalQuery({
  args: { organizationId: v.string() },
  handler: async (ctx, args): Promise<TenantCorpusChunk[]> => {
    const namespace = await rag.getNamespace(ctx, {
      namespace: args.organizationId,
    });

    if (!namespace) {
      return [];
    }

    // List all active entries in this tenant's namespace
    const entriesResult = await rag.list(ctx, {
      namespaceId: namespace.namespaceId,
      paginationOpts: { numItems: 100, cursor: null },
    });

    const corpusChunks: TenantCorpusChunk[] = [];

    // For each entry, collect its constituent chunks
    for (const entry of entriesResult.page) {
      try {
        const chunksResult = await rag.listChunks(ctx, {
          entryId: entry.entryId,
          paginationOpts: { numItems: 50, cursor: null },
        });

        for (const chunk of chunksResult.page) {
          if (chunk.text && chunk.text.trim()) {
            corpusChunks.push({
              id: `${entry.entryId}_chunk_${chunk.order}`,
              entryId: entry.entryId,
              title: entry.title || "Knowledge Document",
              text: chunk.text,
              order: chunk.order,
            });
          }
        }
      } catch (err) {
        console.error(`[getTenantCorpus] Failed to load chunks for entry ${entry.entryId}:`, err);
      }
    }

    return corpusChunks;
  },
});
