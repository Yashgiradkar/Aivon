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

    const corpusChunks: TenantCorpusChunk[] = [];
    // Paginate through all entries (hard-capped at 500 to stay within
    // Convex action time limits; revisit if corpora exceed this scale).
    const ENTRY_PAGE_SIZE = 100;
    const ENTRY_MAX = 500;
    let entryCursor: string | null = null;
    let entryCount = 0;

    do {
      const entriesResult = await rag.list(ctx, {
        namespaceId: namespace.namespaceId,
        paginationOpts: { numItems: ENTRY_PAGE_SIZE, cursor: entryCursor },
      });

      for (const entry of entriesResult.page) {
        entryCount++;
        try {
          // Paginate through chunks within each entry (hard-capped at 200).
          const CHUNK_PAGE_SIZE = 50;
          const CHUNK_MAX = 200;
          let chunkCursor: string | null = null;
          let chunkCount = 0;

          do {
            const chunksResult = await rag.listChunks(ctx, {
              entryId: entry.entryId,
              paginationOpts: { numItems: CHUNK_PAGE_SIZE, cursor: chunkCursor },
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

            chunkCount += chunksResult.page.length;
            chunkCursor = chunksResult.isDone ? null : chunksResult.continueCursor;
          } while (chunkCursor && chunkCount < CHUNK_MAX);
        } catch (err) {
          console.error(`[getTenantCorpus] Failed to load chunks for entry ${entry.entryId}:`, err);
        }
      }

      entryCursor = entriesResult.isDone ? null : entriesResult.continueCursor;
    } while (entryCursor && entryCount < ENTRY_MAX);

    return corpusChunks;
  },
});
