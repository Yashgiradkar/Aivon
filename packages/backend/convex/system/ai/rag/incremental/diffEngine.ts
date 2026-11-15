import { DocumentDiffResult, DocumentManifest, PageUnit } from "./types";

/**
 * Change detection engine that compares existing document page manifests
 * against updated document pages. Accurately isolates unchanged, modified,
 * added, deleted, and reordered pages.
 */
export class DiffEngine {
  /**
   * Computes a fine-grained diff between an existing DocumentManifest and newly parsed PageUnits.
   */
  static computeDiff(
    oldManifest: DocumentManifest | null,
    newPages: PageUnit[],
    documentKey: string,
  ): DocumentDiffResult {
    const totalNewPages = newPages.length;
    const totalOldPages = oldManifest ? oldManifest.totalPages : 0;

    // First-time ingestion: all pages are added
    if (!oldManifest || oldManifest.pages.length === 0) {
      return {
        documentKey,
        totalOldPages: 0,
        totalNewPages,
        unchangedPages: [],
        modifiedPages: [],
        addedPages: newPages.map((p) => p.pageNumber),
        deletedPages: [],
        reorderedPages: [],
        isFullReplacement: true,
        unchangedRatio: 0,
      };
    }

    const oldPagesByNumber = new Map<number, { pageHash: string; chunkHashes: string[] }>();
    const oldPagesByHash = new Map<string, number>();

    for (const page of oldManifest.pages) {
      oldPagesByNumber.set(page.pageNumber, page);
      oldPagesByHash.set(page.pageHash, page.pageNumber);
    }

    const unchangedPages: number[] = [];
    const modifiedPages: number[] = [];
    const addedPages: number[] = [];
    const reorderedPages: Array<{ oldPage: number; newPage: number }> = [];

    const newPageNumbers = new Set<number>();

    for (const newPage of newPages) {
      newPageNumbers.add(newPage.pageNumber);
      const oldPage = oldPagesByNumber.get(newPage.pageNumber);

      if (oldPage && oldPage.pageHash === newPage.pageHash) {
        // Content and page number match exactly
        unchangedPages.push(newPage.pageNumber);
      } else if (oldPagesByHash.has(newPage.pageHash)) {
        // Content moved to a different page number
        const priorPageNum = oldPagesByHash.get(newPage.pageHash)!;
        reorderedPages.push({ oldPage: priorPageNum, newPage: newPage.pageNumber });
      } else if (oldPage) {
        // Page number exists in old doc, but content changed
        modifiedPages.push(newPage.pageNumber);
      } else {
        // New page number beyond previous document length
        addedPages.push(newPage.pageNumber);
      }
    }

    // Identify deleted pages (pages present in old manifest but missing in new document)
    const deletedPages: number[] = [];
    for (const oldPageNum of oldPagesByNumber.keys()) {
      if (!newPageNumbers.has(oldPageNum)) {
        deletedPages.push(oldPageNum);
      }
    }

    const unchangedRatio = totalNewPages > 0 ? unchangedPages.length / totalNewPages : 0;
    const isFullReplacement =
      unchangedPages.length === 0 && reorderedPages.length === 0 && totalOldPages > 0;

    return {
      documentKey,
      totalOldPages,
      totalNewPages,
      unchangedPages,
      modifiedPages,
      addedPages,
      deletedPages,
      reorderedPages,
      isFullReplacement,
      unchangedRatio,
    };
  }
}

