/**
 * Structural Content Block Models for Multi-Format RAG
 * Supports prose, headings, tables with relational cells, charts with axes/series,
 * structured JSON/CSV records, and mixed-format documents.
 */

export type ContentBlockType = "text" | "table" | "chart" | "structured_data";

export interface TextBlock {
  type: "text";
  id: string;
  text: string;
  headingPath?: string[];
  pageNumber?: number;
}

export interface TableBlock {
  type: "table";
  id: string;
  title?: string;
  headers: string[];
  rows: string[][];
  units?: Record<string, string>;
  headingPath?: string[];
  pageNumber?: number;
  summary?: string;
}

export interface ChartSeries {
  name: string;
  values: Array<{ label: string; value: number | string }>;
}

export interface ChartBlock {
  type: "chart";
  id: string;
  title: string;
  chartType?: "line" | "bar" | "pie" | "scatter" | "area" | "unknown";
  xAxis?: string;
  yAxis?: string;
  units?: string;
  series: ChartSeries[];
  summary: string;
  headingPath?: string[];
  pageNumber?: number;
}

export interface StructuredDataBlock {
  type: "structured_data";
  id: string;
  format: "json" | "csv" | "key_value" | "yaml";
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  headingPath?: string[];
  pageNumber?: number;
}

export type ContentBlock = TextBlock | TableBlock | ChartBlock | StructuredDataBlock;

export interface NormalizedDocument {
  filename: string;
  mimeType: string;
  blocks: ContentBlock[];
  metadata: {
    hasTables: boolean;
    hasCharts: boolean;
    hasStructuredData: boolean;
    totalBlocks: number;
    sections: string[];
  };
}

/**
 * Converts a TableBlock into a structure-preserving searchable text chunk.
 * Crucially preserves column-row associations so queries like
 * "What is the refund period for Premium customers?" find the row with both
 * "Premium" and its associated refund period and units.
 */
export function formatTableBlockToSearchable(table: TableBlock): string {
  const parts: string[] = [];
  const headerContext = table.headingPath && table.headingPath.length > 0
    ? `[Section: ${table.headingPath.join(" > ")}] `
    : "";
  const tableTitle = table.title ? `Table: "${table.title}"` : "Structured Table";

  parts.push(`${headerContext}${tableTitle}`);
  if (table.summary) {
    parts.push(`Summary: ${table.summary}`);
  }

  // Column headers with units if present
  const headerRow = table.headers
    .map((h) => {
      const unit = table.units?.[h] ? ` (${table.units[h]})` : "";
      return `${h}${unit}`;
    })
    .join(" | ");
  parts.push(`Headers: | ${headerRow} |`);

  // Row-oriented representation attaching column labels to every single cell value
  parts.push("Data Records:");
  table.rows.forEach((row, rowIndex) => {
    const rowDetails = row
      .map((val, colIndex) => {
        const header = table.headers[colIndex] || `Col_${colIndex + 1}`;
        const unit = table.units?.[header] ? ` ${table.units[header]}` : "";
        return `${header}="${val}${unit}"`;
      })
      .join(", ");
    parts.push(`- Row ${rowIndex + 1}: ${rowDetails}`);
  });

  return parts.join("\n");
}

/**
 * Converts a ChartBlock into a searchable text chunk retaining axis labels,
 * data points, units, and structural trends.
 */
export function formatChartBlockToSearchable(chart: ChartBlock): string {
  const parts: string[] = [];
  const headerContext = chart.headingPath && chart.headingPath.length > 0
    ? `[Section: ${chart.headingPath.join(" > ")}] `
    : "";

  parts.push(`${headerContext}Chart: "${chart.title}" (Type: ${chart.chartType || "chart"})`);
  if (chart.xAxis || chart.yAxis) {
    const unitInfo = chart.units ? ` [Units: ${chart.units}]` : "";
    parts.push(`Axes: X-Axis="${chart.xAxis || "N/A"}", Y-Axis="${chart.yAxis || "N/A"}"${unitInfo}`);
  }

  if (chart.summary) {
    parts.push(`Interpretation: ${chart.summary}`);
  }

  if (chart.series.length > 0) {
    parts.push("Plotted Data Points:");
    chart.series.forEach((s) => {
      const dataStr = s.values.map((v) => `${v.label}=${v.value}`).join(", ");
      parts.push(`- Series "${s.name}": ${dataStr}`);
    });
  }

  return parts.join("\n");
}

/**
 * Converts a StructuredDataBlock (e.g. JSON/CSV objects) into searchable text.
 */
export function formatStructuredDataToSearchable(block: StructuredDataBlock): string {
  const parts: string[] = [];
  const headerContext = block.headingPath && block.headingPath.length > 0
    ? `[Section: ${block.headingPath.join(" > ")}] `
    : "";

  parts.push(`${headerContext}Structured Record (${block.format}):`);

  if (Array.isArray(block.data)) {
    block.data.forEach((item, index) => {
      const entryStr = Object.entries(item)
        .map(([k, v]) => `${k}="${v}"`)
        .join(", ");
      parts.push(`- Item ${index + 1}: ${entryStr}`);
    });
  } else if (typeof block.data === "object" && block.data !== null) {
    Object.entries(block.data).forEach(([key, value]) => {
      const valStr = typeof value === "object" ? JSON.stringify(value) : String(value);
      parts.push(`- ${key}: ${valStr}`);
    });
  }

  return parts.join("\n");
}

/**
 * Formats an entire NormalizedDocument into searchable, structure-preserving
 * chunks suitable for vector embedding and retrieval.
 */
export function serializeNormalizedDocument(doc: NormalizedDocument): string {
  const serializedBlocks: string[] = [];

  for (const block of doc.blocks) {
    switch (block.type) {
      case "text": {
        const header = block.headingPath && block.headingPath.length > 0
          ? `[Section: ${block.headingPath.join(" > ")}]\n`
          : "";
        serializedBlocks.push(`${header}${block.text}`);
        break;
      }
      case "table":
        serializedBlocks.push(formatTableBlockToSearchable(block));
        break;
      case "chart":
        serializedBlocks.push(formatChartBlockToSearchable(block));
        break;
      case "structured_data":
        serializedBlocks.push(formatStructuredDataToSearchable(block));
        break;
    }
  }

  return serializedBlocks.join("\n\n---\n\n");
}
