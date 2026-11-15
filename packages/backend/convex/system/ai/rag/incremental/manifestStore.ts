import { DocumentManifest } from "./types";

/**
 * In-memory & persistent manifest store for tracked RAG documents.
 * Maintains page-level checksums, chunk hashes, and revision history per tenant.
 */
export class DocumentManifestStore {
  private static store = new Map<string, DocumentManifest>();

  private static makeKey(organizationId: string, documentKey: string): string {
    return `${organizationId}:${documentKey}`;
  }

  /**
   * Retrieves the current manifest for a document within a tenant.
   */
  static get(organizationId: string, documentKey: string): DocumentManifest | null {
    return this.store.get(this.makeKey(organizationId, documentKey)) ?? null;
  }

  /**
   * Saves or updates a document manifest.
   */
  static save(manifest: DocumentManifest): void {
    const key = this.makeKey(manifest.organizationId, manifest.documentKey);
    this.store.set(key, { ...manifest, updatedAt: Date.now() });
  }

  /**
   * Removes a document manifest when a document is deleted.
   */
  static delete(organizationId: string, documentKey: string): boolean {
    return this.store.delete(this.makeKey(organizationId, documentKey));
  }

  /**
   * Lists all document manifests for an organization.
   */
  static list(organizationId: string): DocumentManifest[] {
    const prefix = `${organizationId}:`;
    const results: DocumentManifest[] = [];

    for (const [key, manifest] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        results.push(manifest);
      }
    }

    return results;
  }

  /**
   * Gathers all active chunk hashes referenced across all documents of an organization.
   */
  static getActiveChunkHashes(organizationId: string): Set<string> {
    const activeHashes = new Set<string>();
    const manifests = this.list(organizationId);

    for (const doc of manifests) {
      for (const page of doc.pages) {
        for (const chunkHash of page.chunkHashes) {
          activeHashes.add(chunkHash);
        }
      }
    }

    return activeHashes;
  }

  /**
   * Clears the store (for testing purposes).
   */
  static clear(): void {
    this.store.clear();
  }
}

