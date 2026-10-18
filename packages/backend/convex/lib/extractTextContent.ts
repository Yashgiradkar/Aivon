import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { StorageActionWriter } from "convex/server";
import { assert } from "convex-helpers";
import { Id } from "../_generated/dataModel";
import {
  normalizeDocumentContent,
  serializeNormalizedDocument,
  NormalizedDocument,
} from "../system/ai/rag/structure";

const AI_MODELS = {
  image: openai.chat("gpt-4o-mini"),
  pdf: openai.chat("gpt-4o"),
  html: openai.chat("gpt-4o"),
} as const;

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const SYSTEM_PROMPTS = {
  image: `You are an expert document and diagram parser. Analyze the image and extract all information with maximum structural fidelity:
1. If the image contains text, preserve headings with markdown syntax (# Heading 1, ## Heading 2).
2. If the image contains a TABLE, format it as a clean Markdown table with headers and rows (| Header 1 | Header 2 |) preserving all row-to-column cell relationships and units.
3. If the image contains a CHART or GRAPH (bar, line, pie, etc.), extract and format it as:
[CHART: Title="<title>" Type="<bar|line|pie|etc>" X-Axis="<x label>" Y-Axis="<y label>" Units="<units if any>" Summary="<clear analytical summary of trends and values>" Data=<data points>]
4. If it is a generic photo, describe its salient features.
Print the content directly without introductory conversational filler.`,

  pdf: `You are an expert document layout and structure extraction engine. Transform the PDF into Markdown preserving all structure:
1. Preserve document titles and hierarchical headings (# Heading 1, ## Heading 2, ### Heading 3).
2. Format all TABLES as standard Markdown tables (| Col 1 | Col 2 |) with explicit headers and units so that cell values remain bound to their row and column.
3. If there are CHARTS, GRAPHS, or diagrams, format them as:
[CHART: Title="<title>" Type="<bar|line|pie|etc>" X-Axis="<x label>" Y-Axis="<y label>" Units="<units>" Summary="<summary of plotted data and key figures>"]
4. Preserve lists, key-value configurations, and numerical conditions verbatim.
Print the extracted content without conversational explanation.`,

  html: `You transform HTML content into clean, semantic Markdown:
1. Convert headings into #, ##, ### hierarchy.
2. Convert all <table> elements into Markdown tables with headers and rows.
3. Preserve lists, code blocks, and key-value fields.
Print the markdown without conversational explanation.`
};

export type ExtractTextContentArgs = {
  storageId: Id<"_storage">;
  filename: string;
  bytes?: ArrayBuffer;
  mimeType: string;
};

export interface ExtractedDocumentResult {
  text: string;
  normalizedDoc: NormalizedDocument;
}

export async function extractTextContent(
  ctx: { storage: StorageActionWriter },
  args: ExtractTextContentArgs,
): Promise<string> {
  const { storageId, filename, bytes, mimeType } = args;
  const lowerFilename = filename.toLowerCase();

  const url = await ctx.storage.getUrl(storageId);
  assert(url, "Failed to get storage URL");

  let rawExtractedText = "";

  if (SUPPORTED_IMAGE_TYPES.some((type) => type === mimeType)) {
    rawExtractedText = await extractImageText(url);
  } else if (mimeType.toLowerCase().includes("pdf") || lowerFilename.endsWith(".pdf")) {
    rawExtractedText = await extractPdfText(url, mimeType, filename);
  } else if (
    mimeType.toLowerCase().includes("json") ||
    lowerFilename.endsWith(".json")
  ) {
    rawExtractedText = await extractRawBytesText(ctx, storageId, bytes);
  } else if (
    mimeType.toLowerCase().includes("csv") ||
    lowerFilename.endsWith(".csv") ||
    lowerFilename.endsWith(".tsv")
  ) {
    rawExtractedText = await extractRawBytesText(ctx, storageId, bytes);
  } else if (mimeType.toLowerCase().includes("text")) {
    rawExtractedText = await extractTextFileContent(ctx, storageId, bytes, mimeType);
  } else {
    // Attempt raw text decode fallback before failing
    try {
      rawExtractedText = await extractRawBytesText(ctx, storageId, bytes);
    } catch {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  }

  // Structure Recognition & Normalization pipeline
  const normalizedDoc = normalizeDocumentContent(rawExtractedText, filename, mimeType);
  const serializedSearchableText = serializeNormalizedDocument(normalizedDoc);

  return serializedSearchableText || rawExtractedText;
}

async function extractRawBytesText(
  ctx: { storage: StorageActionWriter },
  storageId: Id<"_storage">,
  bytes: ArrayBuffer | undefined
): Promise<string> {
  const arrayBuffer =
    bytes || (await (await ctx.storage.get(storageId))?.arrayBuffer());

  if (!arrayBuffer) {
    throw new Error("Failed to get file content");
  }

  return new TextDecoder().decode(arrayBuffer);
}

async function extractTextFileContent(
  ctx: { storage: StorageActionWriter },
  storageId: Id<"_storage">,
  bytes: ArrayBuffer | undefined,
  mimeType: string
): Promise<string> {
  const text = await extractRawBytesText(ctx, storageId, bytes);

  if (mimeType.toLowerCase() !== "text/plain") {
    const result = await generateText({
      model: AI_MODELS.html,
      system: SYSTEM_PROMPTS.html,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text },
            {
              type: "text",
              text: "Extract the content into structured markdown preserving all tables and headings without conversational explanation."
            },
          ],
        },
      ],
    });

    return result.text;
  }

  return text;
}

async function extractPdfText(
  url: string,
  mimeType: string,
  filename: string,
): Promise<string> {
  const result = await generateText({
    model: AI_MODELS.pdf,
    system: SYSTEM_PROMPTS.pdf,
    messages: [
      {
        role: "user",
        content: [
          { type: "file", data: new URL(url), mimeType, filename },
          {
            type: "text",
            text: "Extract the full text, tables, headings, and charts from the PDF into structured markdown format without conversational explanation.",
          }
        ]
      }
    ]
  });

  return result.text;
}

async function extractImageText(url: string): Promise<string> {
  const result = await generateText({
    model: AI_MODELS.image,
    system: SYSTEM_PROMPTS.image,
    messages: [
      {
        role: "user",
        content: [{ type: "image", image: new URL(url) }]
      },
    ],
  });

  return result.text;
}
