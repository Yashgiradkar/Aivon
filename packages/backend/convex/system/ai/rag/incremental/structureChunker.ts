import { PageUnit, StructuredChunk } from "./types";
import { computeContentHash } from "./pageSplitter";

export interface ChunkerOptions {
  maxChunkSize?: number; // Target characters per chunk (default 1800 ~450 tokens)
  overlapSize?: number; // Overlap characters (default 200 ~50 tokens)
}

/**
 * Structure-aware chunker that preserves tables, code blocks, lists, and heading hierarchies
 * while maintaining stable identifiers and page association.
 */
export class StructureChunker {
  /**
   * Chunks a single PageUnit into StructuredChunks.
   */
  static chunkPage(
    page: PageUnit,
    documentKey: string,
    options: ChunkerOptions = {},
  ): StructuredChunk[] {
    const maxChunkSize = options.maxChunkSize ?? 1800;
    const overlapSize = options.overlapSize ?? 200;

    const text = page.text.trim();
    if (!text) return [];

    // Parse blocks from page text, identifying tables, code blocks, and paragraphs
    const rawBlocks = this.extractBlocks(text);
    const chunks: StructuredChunk[] = [];
    let currentChunkText = "";
    let currentHeadings: string[] = page.title ? [page.title] : [];
    let chunkIndex = 0;
    let isCurrentTable = false;

    const flushChunk = () => {
      const cleanText = currentChunkText.trim();
      if (cleanText.length > 0) {
        // Prepend contextual heading tag if present
        const headingContext =
          currentHeadings.length > 0
            ? `[Section: ${currentHeadings.join(" > ")}]\n`
            : "";
        const fullSearchableText = cleanText.startsWith("[Section:")
          ? cleanText
          : `${headingContext}${cleanText}`;

        const chunkHash = computeContentHash(fullSearchableText);
        chunks.push({
          id: `${documentKey}_p${page.pageNumber}_c${chunkIndex}`,
          documentKey,
          pageNumber: page.pageNumber,
          section: currentHeadings[currentHeadings.length - 1],
          headingPath: currentHeadings.length > 0 ? [...currentHeadings] : undefined,
          chunkIndex,
          text: fullSearchableText,
          chunkHash,
          isTable: isCurrentTable,
          metadata: {
            pageNumber: page.pageNumber,
            chunkIndex,
            chunkHash,
            isTable: isCurrentTable,
          },
        });
        chunkIndex++;
      }
      currentChunkText = "";
      isCurrentTable = false;
    };

    for (const block of rawBlocks) {
      // Update heading tracking
      if (block.type === "heading") {
        currentHeadings = block.headingHierarchy;
        if (currentChunkText.length > 0) {
          flushChunk();
        }
        currentChunkText = block.content;
        continue;
      }

      // If block is a self-contained table, preserve it intact without slicing mid-table
      if (block.type === "table") {
        if (currentChunkText.length > 0) {
          flushChunk();
        }
        currentChunkText = block.content;
        isCurrentTable = true;
        flushChunk();
        continue;
      }

      // If block is a code block, preserve intact if fits, or flush before
      if (block.type === "code") {
        if (currentChunkText.length > 0 && currentChunkText.length + block.content.length > maxChunkSize) {
          flushChunk();
        }
        currentChunkText += (currentChunkText ? "\n\n" : "") + block.content;
        if (currentChunkText.length >= maxChunkSize) {
          flushChunk();
        }
        continue;
      }

      // Standard prose paragraph
      if (currentChunkText.length + block.content.length <= maxChunkSize) {
        currentChunkText += (currentChunkText ? "\n\n" : "") + block.content;
      } else {
        // If current chunk already has content, flush it
        if (currentChunkText.length > 0) {
          const overlap = this.computeOverlap(currentChunkText, overlapSize);
          flushChunk();
          currentChunkText = overlap ? `${overlap}\n\n${block.content}` : block.content;
        } else {
          // Paragraph itself exceeds maxChunkSize: slice on sentence boundaries
          const subChunks = this.splitLongText(block.content, maxChunkSize, overlapSize);
          for (let i = 0; i < subChunks.length; i++) {
            const subChunk = subChunks[i];
            if (!subChunk) continue;
            currentChunkText = subChunk;
            if (i < subChunks.length - 1) {
              flushChunk();
            }
          }
        }
      }
    }

    flushChunk();
    return chunks;
  }

  /**
   * Chunks multiple PageUnits across an entire document.
   */
  static chunkDocument(
    pages: PageUnit[],
    documentKey: string,
    options: ChunkerOptions = {},
  ): StructuredChunk[] {
    const allChunks: StructuredChunk[] = [];
    for (const page of pages) {
      const pageChunks = this.chunkPage(page, documentKey, options);
      allChunks.push(...pageChunks);
    }
    return allChunks;
  }

  private static computeOverlap(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) return "";
    const tail = text.slice(-overlapSize).trim();
    // Try to snap to the beginning of a sentence or line
    const lastNewline = tail.indexOf("\n");
    if (lastNewline !== -1 && lastNewline < tail.length - 20) {
      return tail.slice(lastNewline + 1).trim();
    }
    const lastPeriod = tail.indexOf(". ");
    if (lastPeriod !== -1 && lastPeriod < tail.length - 20) {
      return tail.slice(lastPeriod + 2).trim();
    }
    return tail;
  }

  private static splitLongText(text: string, maxChunkSize: number, overlapSize: number): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [text];
    const chunks: string[] = [];
    let current = "";

    for (const sentence of sentences) {
      if (current.length + sentence.length <= maxChunkSize) {
        current += sentence;
      } else {
        if (current) chunks.push(current.trim());
        const overlap = this.computeOverlap(current, overlapSize);
        current = overlap ? `${overlap} ${sentence}` : sentence;
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text];
  }

  private static extractBlocks(
    text: string,
  ): Array<
    | { type: "heading"; content: string; headingHierarchy: string[] }
    | { type: "table"; content: string }
    | { type: "code"; content: string }
    | { type: "paragraph"; content: string }
  > {
    const lines = text.split("\n");
    const blocks: Array<
      | { type: "heading"; content: string; headingHierarchy: string[] }
      | { type: "table"; content: string }
      | { type: "code"; content: string }
      | { type: "paragraph"; content: string }
    > = [];

    let currentHierarchy: string[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let inTable = false;
    let tableBuffer: string[] = [];
    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
      if (paragraphBuffer.length > 0) {
        const p = paragraphBuffer.join("\n").trim();
        if (p) blocks.push({ type: "paragraph", content: p });
        paragraphBuffer = [];
      }
    };

    const flushTable = () => {
      if (tableBuffer.length > 0) {
        const tbl = tableBuffer.join("\n").trim();
        if (tbl) blocks.push({ type: "table", content: tbl });
        tableBuffer = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const trimmed = line.trim();

      // Code blocks
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          codeBuffer.push(line);
          blocks.push({ type: "code", content: codeBuffer.join("\n") });
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          flushParagraph();
          if (inTable) flushTable();
          inCodeBlock = true;
          codeBuffer.push(line);
        }
        continue;
      }
      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Headings: #, ##, ###
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch && headingMatch[1] && headingMatch[2]) {
        flushParagraph();
        if (inTable) flushTable();

        const level = headingMatch[1].length;
        const headingTitle = headingMatch[2].trim();
        // Adjust hierarchy
        currentHierarchy = currentHierarchy.slice(0, level - 1);
        currentHierarchy.push(headingTitle);

        blocks.push({
          type: "heading",
          content: trimmed,
          headingHierarchy: [...currentHierarchy],
        });
        continue;
      }

      // Markdown Table line: starts and ends with | or separator |---|
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        flushParagraph();
        inTable = true;
        tableBuffer.push(trimmed);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Empty line separates paragraphs
      if (!trimmed) {
        flushParagraph();
        continue;
      }

      paragraphBuffer.push(line);
    }

    flushParagraph();
    if (inTable) flushTable();

    return blocks;
  }
}

