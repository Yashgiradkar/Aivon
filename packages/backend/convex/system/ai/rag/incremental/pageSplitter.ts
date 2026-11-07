import crypto from "node:crypto";
import { PageUnit } from "./types";

/**
 * Computes a deterministic SHA-256 checksum for arbitrary string content.
 */
export function computeContentHash(content: string): string {
  return crypto
    .createHash("sha256")
    .update(content.trim())
    .digest("hex");
}

/**
 * Page-aware and structure-aware document splitter.
 * Segments documents into discrete, stable page or section units while preserving
 * layout boundaries and calculating deterministic content checksums.
 */
export class PageSplitter {
  /**
   * Splits a raw document string into PageUnits.
   * Prioritizes explicit page breaks (\f, page markers), then section headings,
   * falling back to paragraph-budgeted logical pages.
   */
  static splitDocument(rawText: string, filename: string): PageUnit[] {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return [];
    }

    // 1. Check for standard form feed (\f) page breaks (universal PDF/OCR format)
    if (trimmed.includes("\f")) {
      return this.splitByFormFeed(trimmed);
    }

    // 2. Check for explicit page comment/rule markers (e.g., "--- [Page 1] ---" or "<!-- page: 1 -->")
    const pageMarkerRegex = /(?:^|\n)(?:---+\s*\[Page\s+(\d+)\]\s*---+|<!--\s*page:\s*(\d+)\s*-->|===\s*Page\s+(\d+)\s*===)/i;
    if (pageMarkerRegex.test(trimmed)) {
      return this.splitByPageMarkers(trimmed);
    }

    // 3. Check for Markdown horizontal rules acting as page breaks ("\n---\n")
    const markdownHrRegex = /\n\s*---\s*\n/;
    if (markdownHrRegex.test(trimmed)) {
      return this.splitByHorizontalRules(trimmed);
    }

    // 4. For structured Markdown without page breaks, split by major top-level headings (# Heading)
    const heading1Regex = /(?:^|\n)#\s+[^\n]+/g;
    const h1Matches = Array.from(trimmed.matchAll(heading1Regex));
    if (h1Matches.length > 2) {
      return this.splitByHeadings(trimmed, h1Matches);
    }

    // 5. Fallback: Logical page budgeting on paragraph boundaries (~350-500 words per page)
    return this.splitByLogicalParagraphBudget(trimmed);
  }

  /**
   * Splits text on universal Form Feed (\f) characters.
   */
  private static splitByFormFeed(text: string): PageUnit[] {
    const rawPages = text.split("\f");
    const pages: PageUnit[] = [];
    let pageNum = 1;

    for (const raw of rawPages) {
      const pageText = raw.trim();
      if (pageText.length > 0) {
        pages.push({
          pageNumber: pageNum,
          pageId: `p_${pageNum}`,
          text: pageText,
          pageHash: computeContentHash(pageText),
        });
        pageNum++;
      }
    }

    return pages;
  }

  /**
   * Splits text using explicit page markers like "--- [Page 1] ---".
   */
  private static splitByPageMarkers(text: string): PageUnit[] {
    const delimiterPattern = /(?:^|\n)(?:---+\s*\[Page\s+(\d+)\]\s*---+|<!--\s*page:\s*(\d+)\s*-->|===\s*Page\s+(\d+)\s*===)/gi;
    const pages: PageUnit[] = [];
    let lastIndex = 0;
    let currentPageNum = 1;
    let match: RegExpExecArray | null;

    const matches: Array<{ index: number; length: number; declaredPage?: number }> = [];
    while ((match = delimiterPattern.exec(text)) !== null) {
      const declaredNum = Number(match[1] || match[2] || match[3]);
      matches.push({
        index: match.index,
        length: match[0].length,
        declaredPage: Number.isFinite(declaredNum) ? declaredNum : undefined,
      });
    }

    if (matches.length === 0) {
      return this.splitByLogicalParagraphBudget(text);
    }

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
      const content = text.slice(m.index + m.length, nextIndex).trim();

      if (content.length > 0) {
        const pageNumber = m.declaredPage ?? currentPageNum;
        pages.push({
          pageNumber,
          pageId: `p_${pageNumber}`,
          text: content,
          pageHash: computeContentHash(content),
        });
        currentPageNum = pageNumber + 1;
      }
    }

    return pages;
  }

  /**
   * Splits text by Markdown horizontal rules ("---").
   */
  private static splitByHorizontalRules(text: string): PageUnit[] {
    const rawParts = text.split(/\n\s*---\s*\n/);
    const pages: PageUnit[] = [];
    let pageNum = 1;

    for (const part of rawParts) {
      const clean = part.trim();
      if (clean.length > 0) {
        pages.push({
          pageNumber: pageNum,
          pageId: `p_${pageNum}`,
          text: clean,
          pageHash: computeContentHash(clean),
        });
        pageNum++;
      }
    }

    return pages;
  }

  /**
   * Splits by top-level # Headings.
   */
  private static splitByHeadings(
    text: string,
    matches: RegExpMatchArray[],
  ): PageUnit[] {
    const pages: PageUnit[] = [];

    for (let i = 0; i < matches.length; i++) {
      const startIndex = matches[i].index!;
      const endIndex = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const sectionText = text.slice(startIndex, endIndex).trim();

      const titleMatch = sectionText.match(/^#\s+([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : undefined;
      const pageNum = i + 1;

      pages.push({
        pageNumber: pageNum,
        pageId: `p_${pageNum}`,
        title,
        text: sectionText,
        pageHash: computeContentHash(sectionText),
      });
    }

    return pages;
  }

  /**
   * Fallback: Segments text into logical pages based on paragraph boundaries.
   * Uses a target budget of ~400-500 words per logical page.
   */
  private static splitByLogicalParagraphBudget(
    text: string,
    targetWordsPerPage: number = 400,
  ): PageUnit[] {
    const paragraphs = text.split(/\n\s*\n/);
    const pages: PageUnit[] = [];
    let currentPageParagraphs: string[] = [];
    let currentWordCount = 0;
    let pageNum = 1;

    const flushPage = () => {
      if (currentPageParagraphs.length > 0) {
        const pageText = currentPageParagraphs.join("\n\n").trim();
        if (pageText.length > 0) {
          pages.push({
            pageNumber: pageNum,
            pageId: `p_${pageNum}`,
            text: pageText,
            pageHash: computeContentHash(pageText),
          });
          pageNum++;
        }
        currentPageParagraphs = [];
        currentWordCount = 0;
      }
    };

    for (const para of paragraphs) {
      const paraClean = para.trim();
      if (!paraClean) continue;

      const words = paraClean.split(/\s+/).length;
      if (currentWordCount + words > targetWordsPerPage && currentPageParagraphs.length > 0) {
        flushPage();
      }

      currentPageParagraphs.push(paraClean);
      currentWordCount += words;
    }

    flushPage();
    return pages;
  }
}

