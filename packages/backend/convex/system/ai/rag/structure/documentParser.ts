import {
  ContentBlock,
  NormalizedDocument,
  TableBlock,
  ChartBlock,
  StructuredDataBlock,
  TextBlock,
} from "./contentBlocks";

/**
 * Parses CSV or TSV string into a TableBlock preserving headers, units, and row relationships.
 */
export function parseDelimitedTextToTable(
  rawText: string,
  filename: string,
  delimiter: string = ","
): TableBlock {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      type: "table",
      id: `tbl_${Date.now()}`,
      title: filename,
      headers: ["Empty"],
      rows: [],
    };
  }

  // Simple CSV quote-aware splitter
  const splitLine = (line: string): string[] => {
    const pattern = new RegExp(
      `(${delimiter}|\\r?\\n|\\r|^)(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}\\r\\n]*))`,
      "gi"
    );
    const result: string[] = [];
    let match;
    while ((match = pattern.exec(line))) {
      const quoted = match[2];
      const unquoted = match[3];
      if (quoted !== undefined) {
        result.push(quoted.replace(/""/g, '"').trim());
      } else if (unquoted !== undefined) {
        result.push(unquoted.trim());
      }
    }
    return result.length > 0 ? result : line.split(delimiter).map((c) => c.trim());
  };

  const headers = splitLine(lines[0] || "");
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const parsedRow = splitLine(lines[i] || "");
    if (parsedRow.length > 0 && parsedRow.some((cell) => cell.length > 0)) {
      rows.push(parsedRow);
    }
  }

  // Extract units if present in header, e.g. "Price ($)" or "Duration (mins)"
  const units: Record<string, string> = {};
  const cleanedHeaders = headers.map((h) => {
    const unitMatch = h.match(/\(([^)]+)\)/);
    if (unitMatch?.[1]) {
      units[h] = unitMatch[1];
    }
    return h;
  });

  return {
    type: "table",
    id: `tbl_${Math.random().toString(36).substring(2, 9)}`,
    title: filename.replace(/\.[^/.]+$/, ""),
    headers: cleanedHeaders,
    rows,
    units: Object.keys(units).length > 0 ? units : undefined,
  };
}

/**
 * Parses JSON content into structured records or tables.
 */
export function parseJsonToStructuredBlocks(
  jsonText: string,
  filename: string
): ContentBlock[] {
  try {
    const parsed = JSON.parse(jsonText);
    const title = filename.replace(/\.[^/.]+$/, "");

    // If it's an array of flat objects, normalize as a TableBlock
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0] === "object" &&
      parsed[0] !== null
    ) {
      const headers = Array.from(
        new Set(parsed.flatMap((item) => Object.keys(item)))
      );
      const rows = parsed.map((item) =>
        headers.map((h) => (item[h] !== undefined ? String(item[h]) : ""))
      );

      return [
        {
          type: "table",
          id: `tbl_json_${Date.now()}`,
          title,
          headers,
          rows,
        },
      ];
    }

    // Otherwise treat as structured_data block
    return [
      {
        type: "structured_data",
        id: `struct_json_${Date.now()}`,
        format: "json",
        data: parsed,
      },
    ];
  } catch {
    return [
      {
        type: "text",
        id: `txt_${Date.now()}`,
        text: jsonText,
      },
    ];
  }
}

/**
 * Parses Markdown or text documents into structured sections, markdown tables,
 * and chart annotations.
 */
export function parseMarkdownToContentBlocks(markdownText: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = markdownText.split(/\r?\n/);

  let currentHeadingPath: string[] = [];
  let currentParagraphLines: string[] = [];
  let inTable = false;
  let tableLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const text = currentParagraphLines.join("\n").trim();
      if (text.length > 0) {
        // Check if paragraph is an explicit chart descriptor
        // Format: [CHART: Title="...", Type="...", X-Axis="...", Y-Axis="...", Series="..."]
        const chartMatch = text.match(/\[CHART:\s*Title="([^"]+)"(?:\s*Type="([^"]+)")?(?:\s*X-Axis="([^"]+)")?(?:\s*Y-Axis="([^"]+)")?(?:\s*Units="([^"]+)")?(?:\s*Summary="([^"]+)")?(?:\s*Data=(?:\[.*?\]|\{.*?\}))?\]/s);

        if (chartMatch) {
          blocks.push({
            type: "chart",
            id: `chart_${Date.now()}_${blocks.length}`,
            title: chartMatch[1] || "Extracted Chart",
            chartType: (chartMatch[2] as any) || "line",
            xAxis: chartMatch[3],
            yAxis: chartMatch[4],
            units: chartMatch[5],
            summary: chartMatch[6] || text,
            series: [],
            headingPath: [...currentHeadingPath],
          });
        } else {
          blocks.push({
            type: "text",
            id: `txt_${Date.now()}_${blocks.length}`,
            text,
            headingPath: [...currentHeadingPath],
          });
        }
      }
      currentParagraphLines = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length >= 2) {
      const parsedRows = tableLines.map((line) =>
        line
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim())
      );

      // Filter out markdown separator line (e.g. |---|---|)
      const dataRows = parsedRows.filter(
        (row) => !row.every((cell) => /^[-:\s]+$/.test(cell))
      );

      if (dataRows.length > 0) {
        const headers = dataRows[0] || [];
        const rows = dataRows.slice(1);

        blocks.push({
          type: "table",
          id: `tbl_md_${Date.now()}_${blocks.length}`,
          headers,
          rows,
          headingPath: [...currentHeadingPath],
        });
      }
    }
    tableLines = [];
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for Headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      if (inTable) flushTable();

      const level = (headingMatch[1] || "#").length;
      const headingText = headingMatch[2]?.trim() || "";

      // Maintain hierarchical heading path
      currentHeadingPath = currentHeadingPath.slice(0, level - 1);
      currentHeadingPath.push(headingText);
      continue;
    }

    // Check for Markdown table line
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushParagraph();
      inTable = true;
      tableLines.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Accumulate regular prose paragraph
    if (trimmed.length > 0) {
      currentParagraphLines.push(trimmed);
    } else {
      flushParagraph();
    }
  }

  flushParagraph();
  if (inTable) flushTable();

  return blocks;
}

/**
 * Main ingestion entry point that determines content type and produces
 * a NormalizedDocument with structured ContentBlocks.
 */
export function normalizeDocumentContent(
  rawContent: string,
  filename: string,
  mimeType: string
): NormalizedDocument {
  const lowerName = filename.toLowerCase();
  let blocks: ContentBlock[] = [];

  if (
    mimeType.includes("csv") ||
    mimeType.includes("tab-separated") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".tsv")
  ) {
    const delimiter = lowerName.endsWith(".tsv") ? "\t" : ",";
    blocks = [parseDelimitedTextToTable(rawContent, filename, delimiter)];
  } else if (
    mimeType.includes("json") ||
    lowerName.endsWith(".json")
  ) {
    blocks = parseJsonToStructuredBlocks(rawContent, filename);
  } else {
    // Markdown, HTML, extracted PDF text, or plain text
    blocks = parseMarkdownToContentBlocks(rawContent);
  }

  // Fallback if no blocks were produced
  if (blocks.length === 0) {
    blocks = [
      {
        type: "text",
        id: `txt_fallback_${Date.now()}`,
        text: rawContent,
      },
    ];
  }

  const sections = Array.from(
    new Set(blocks.flatMap((b) => b.headingPath || []))
  );

  return {
    filename,
    mimeType,
    blocks,
    metadata: {
      hasTables: blocks.some((b) => b.type === "table"),
      hasCharts: blocks.some((b) => b.type === "chart"),
      hasStructuredData: blocks.some((b) => b.type === "structured_data"),
      totalBlocks: blocks.length,
      sections,
    },
  };
}
