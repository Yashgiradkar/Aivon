import { ConvexError } from "convex/values";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_PDF_PAGE_COUNT = 200;
const MAX_FILENAME_LENGTH = 120;

const ALLOWED_TYPES = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
} as const;

type AllowedExtension = keyof typeof ALLOWED_TYPES;

export type ValidatedUpload = {
  filename: string;
  mimeType: (typeof ALLOWED_TYPES)[AllowedExtension];
};

function reject(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

function validateText(bytes: Uint8Array, extension: AllowedExtension): void {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    reject("Text uploads must be valid UTF-8.");
  }

  if (
    /\u0000/.test(text) ||
    /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(text)
  ) {
    reject("Text uploads contain unsupported control characters.");
  }

  if (extension === ".json") {
    try {
      JSON.parse(text);
    } catch {
      reject("JSON uploads must contain valid JSON.");
    }
  }
}

function validatePdf(bytes: Uint8Array): void {
  if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    reject("PDF signature is invalid.");
  }

  const sample = new TextDecoder("latin1").decode(bytes);
  const trailer = sample.slice(-2048);
  if (!trailer.includes("%%EOF")) reject("PDF structure is incomplete.");

  const pageCount = (sample.match(/\/Type\s*\/Page\b/g) ?? []).length;
  if (pageCount > MAX_PDF_PAGE_COUNT) reject("PDF exceeds the 200 page limit.");

  if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/i.test(sample)) {
    reject("PDF contains active or embedded content that is not allowed.");
  }
}

/** Validates an untrusted upload before it is stored or sent to an AI parser. */
export function validateKnowledgeBaseUpload(
  suppliedFilename: string,
  bytes: ArrayBuffer,
): ValidatedUpload {
  const filename = suppliedFilename.trim();
  if (
    !filename ||
    filename.length > MAX_FILENAME_LENGTH ||
    filename !== filename.split(/[\\/]/).pop() ||
    /[\u0000-\u001F\u007F]/.test(filename)
  ) {
    reject("Filename is invalid.");
  }

  const extension = filename
    .slice(filename.lastIndexOf("."))
    .toLowerCase() as AllowedExtension;
  const mimeType = ALLOWED_TYPES[extension];
  if (!mimeType) reject("This file type is not supported.");

  const content = new Uint8Array(bytes);
  if (content.byteLength === 0 || content.byteLength > MAX_FILE_SIZE_BYTES) {
    reject("Files must be between 1 byte and 10 MB.");
  }

  if ([".txt", ".csv", ".tsv", ".json"].includes(extension)) {
    if (content.byteLength > MAX_TEXT_FILE_SIZE_BYTES)
      reject("Text files must not exceed 2 MB.");
    validateText(content, extension);
  } else if (extension === ".pdf") {
    validatePdf(content);
  } else if (
    extension === ".png" &&
    !startsWith(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    reject("PNG signature is invalid.");
  } else if (
    [".jpg", ".jpeg"].includes(extension) &&
    !startsWith(content, [0xff, 0xd8, 0xff])
  ) {
    reject("JPEG signature is invalid.");
  } else if (extension === ".webp" && !hasWebpSignature(content)) {
    reject("WebP signature is invalid.");
  }

  return { filename, mimeType };
}

/**
 * Calls a deployment-provided malware scanner. The scanner receives raw bytes
 * and must return JSON `{ "clean": true }`; every other response fails closed.
 */
export async function scanUploadForMalware(
  bytes: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<void> {
  const scannerUrl = process.env.MALWARE_SCANNER_URL;
  const scannerToken = process.env.MALWARE_SCANNER_TOKEN;
  if (!scannerUrl || !scannerToken) {
    reject(
      "File scanning is not configured. Uploads are temporarily unavailable.",
    );
  }

  let parsedScannerUrl: URL;
  try {
    parsedScannerUrl = new URL(scannerUrl);
  } catch {
    reject("File scanning is not configured. Uploads are temporarily unavailable.");
  }
  if (parsedScannerUrl.protocol !== "https:") {
    reject("File scanning is not configured. Uploads are temporarily unavailable.");
  }

  let response: Response;
  try {
    response = await fetch(parsedScannerUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${scannerToken}`,
        "Content-Type": mimeType,
        "X-Upload-Filename": encodeURIComponent(filename),
      },
      body: bytes,
    });
  } catch {
    reject(
      "File scanning is unavailable. Uploads are temporarily unavailable.",
    );
  }

  if (!response.ok)
    reject("File scanning failed. Uploads are temporarily unavailable.");

  try {
    const result = (await response.json()) as { clean?: boolean };
    if (result.clean !== true)
      reject("The file was rejected by malware scanning.");
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    reject("File scanning returned an invalid response.");
  }
}
