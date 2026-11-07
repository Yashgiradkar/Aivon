import { PageUnit } from "./types";

/**
 * Pure JavaScript implementation of SHA-256 (FIPS 180-4).
 * Fully compatible with Convex's V8 isolated runtime, Edge, and Node.js
 * without importing "node:crypto". Produces standard 64-character hex digests.
 */
function sha256(ascii: string): string {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = "length";
  let i = 0;
  let j = 0;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  // Initial hash values: first 32 bits of fractional parts of square roots of first 8 primes 2..19
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  // Round constants: first 32 bits of fractional parts of cube roots of first 64 primes 2..311
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  // Convert string to UTF-8 bytes represented in 32-bit big-endian words
  const utf8Bytes: number[] = [];
  for (let c = 0; c < ascii.length; c++) {
    let charcode = ascii.charCodeAt(c);
    if (charcode < 0x80) {
      utf8Bytes.push(charcode);
    } else if (charcode < 0x800) {
      utf8Bytes.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8Bytes.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      c++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (ascii.charCodeAt(c) & 0x3ff));
      utf8Bytes.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f),
      );
    }
  }

  const bitLength = utf8Bytes.length * 8;
  utf8Bytes.push(0x80);
  while ((utf8Bytes.length % 64) !== 56) {
    utf8Bytes.push(0);
  }
  // Append original 64-bit length
  for (let b = 7; b >= 0; b--) {
    utf8Bytes.push((bitLength >>> (b * 8)) & 0xff);
  }

  for (let b = 0; b < utf8Bytes.length; b += 4) {
    words.push(
      ((utf8Bytes[b] ?? 0) << 24) |
      ((utf8Bytes[b + 1] ?? 0) << 16) |
      ((utf8Bytes[b + 2] ?? 0) << 8) |
      (utf8Bytes[b + 3] ?? 0)
    );
  }

  const w = new Array<number>(64);
  for (i = 0; i < words.length; i += 16) {
    let [a, b, c, d, e, f, g, h] = hash;

    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] ?? 0;
      } else {
        const gamma0x = w[j - 15] ?? 0;
        const gamma1x = w[j - 2] ?? 0;
        const s0 = ((gamma0x >>> 7) | (gamma0x << 25)) ^ ((gamma0x >>> 18) | (gamma0x << 14)) ^ (gamma0x >>> 3);
        const s1 = ((gamma1x >>> 17) | (gamma1x << 15)) ^ ((gamma1x >>> 19) | (gamma1x << 13)) ^ (gamma1x >>> 10);
        w[j] = (((w[j - 16] ?? 0) + s0) | 0) + (((w[j - 7] ?? 0) + s1) | 0);
      }

      const currentW = w[j] ?? 0;
      const currentK = k[j] ?? 0;
      const ch = (e! & f!) ^ (~e! & g!);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const sigma0 = ((a! >>> 2) | (a! << 30)) ^ ((a! >>> 13) | (a! << 19)) ^ ((a! >>> 22) | (a! << 10));
      const sigma1 = ((e! >>> 6) | (e! << 26)) ^ ((e! >>> 11) | (e! << 21)) ^ ((e! >>> 25) | (e! << 7));
      const temp1 = (((h! + sigma1) | 0) + ((ch + currentK) | 0) + currentW) | 0;
      const temp2 = (sigma0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d! + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0]! + a!) | 0;
    hash[1] = (hash[1]! + b!) | 0;
    hash[2] = (hash[2]! + c!) | 0;
    hash[3] = (hash[3]! + d!) | 0;
    hash[4] = (hash[4]! + e!) | 0;
    hash[5] = (hash[5]! + f!) | 0;
    hash[6] = (hash[6]! + g!) | 0;
    hash[7] = (hash[7]! + h!) | 0;
  }

  for (i = 0; i < 8; i++) {
    result += ((hash[i]! >>> 0).toString(16)).padStart(8, "0");
  }

  return result;
}

/**
 * Computes a deterministic SHA-256 (64-char hex) checksum for arbitrary string content.
 * Runs in pure standard JavaScript (fully compatible with Convex V8 runtime, Node.js, and edge runtimes)
 * without requiring "node:crypto" or external dependencies.
 */
export function computeContentHash(content: string): string {
  return sha256(content.trim());
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
      if (!m) continue;
      const nextMatch = i + 1 < matches.length ? matches[i + 1] : undefined;
      const nextIndex = nextMatch ? nextMatch.index : text.length;
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
      const cur = matches[i];
      if (!cur || cur.index === undefined) continue;
      const startIndex = cur.index;
      const nextMatch = i + 1 < matches.length ? matches[i + 1] : undefined;
      const endIndex = nextMatch && nextMatch.index !== undefined ? nextMatch.index : text.length;
      const sectionText = text.slice(startIndex, endIndex).trim();

      const titleMatch = sectionText.match(/^#\s+([^\n]+)/);
      const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : undefined;
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

