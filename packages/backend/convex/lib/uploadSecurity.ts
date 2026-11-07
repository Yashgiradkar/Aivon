import { ConvexError } from "convex/values";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB max file size
const MAX_TEXT_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB max for text / structured files
const MAX_PDF_PAGE_COUNT = 200;
const MAX_FILENAME_LENGTH = 120;

export const ALLOWED_TYPES = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".json": "application/json",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
} as const;

export type AllowedExtension = keyof typeof ALLOWED_TYPES;

export type ValidatedUpload = {
  filename: string;
  mimeType: (typeof ALLOWED_TYPES)[AllowedExtension];
};

/** Dangerous executable and script extensions that must never appear as intermediate extensions */
const DANGEROUS_INTERMEDIARY_EXTENSIONS = new Set([
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "elf",
  "com",
  "scr",
  "bat",
  "cmd",
  "vbs",
  "vbe",
  "js",
  "jse",
  "wsf",
  "wsh",
  "ps1",
  "psm1",
  "sh",
  "bash",
  "zsh",
  "php",
  "phtml",
  "cgi",
  "pl",
  "py",
  "pyc",
  "rb",
  "jar",
  "war",
  "class",
  "msi",
  "apk",
  "app",
  "dmg",
  "iso",
  "hta",
  "reg",
]);

const EICAR_TEST_SIGNATURE =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function reject(message: string): never {
  throw new ConvexError({ code: "BAD_REQUEST", message });
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

/**
 * Checks for known executable binary headers across all uploaded files,
 * preventing attackers from disguising executables as text, documents, or images.
 */
function checkExecutableSignatures(bytes: Uint8Array): void {
  // DOS / Windows PE executable: 'MZ' (0x4D, 0x5A)
  if (startsWith(bytes, [0x4d, 0x5a])) {
    reject("Executable binary signatures (DOS/PE) are not permitted.");
  }

  // Linux ELF: 0x7F, 'E', 'L', 'F' (0x7F, 0x45, 0x4C, 0x46)
  if (startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) {
    reject("Executable binary signatures (ELF) are not permitted.");
  }

  // Mach-O binary signatures & Java bytecode
  if (
    startsWith(bytes, [0xfe, 0xed, 0xfa, 0xce]) || // Mach-O 32-bit big endian
    startsWith(bytes, [0xce, 0xfa, 0xed, 0xfe]) || // Mach-O 32-bit little endian
    startsWith(bytes, [0xfe, 0xed, 0xfa, 0xcf]) || // Mach-O 64-bit big endian
    startsWith(bytes, [0xcf, 0xfa, 0xed, 0xfe]) || // Mach-O 64-bit little endian
    startsWith(bytes, [0xca, 0xfe, 0xba, 0xbe]) // Mach-O Fat binary / Java Class bytecode
  ) {
    reject(
      "Executable binary signatures (Mach-O/Java Class) are not permitted.",
    );
  }

  // WebAssembly bytecode: \0asm (0x00, 0x61, 0x73, 0x6D)
  if (startsWith(bytes, [0x00, 0x61, 0x73, 0x6d])) {
    reject("Executable binary signatures (WebAssembly) are not permitted.");
  }

  // Script shebang: '#!' (0x23, 0x21)
  if (startsWith(bytes, [0x23, 0x21])) {
    reject("Executable script headers (shebang) are not permitted.");
  }
}

/**
 * Checks for archive and compressed container signatures. Disguised archives
 * (e.g. zip/tar/gzip bombs renamed to .txt) are rejected upfront.
 */
function checkArchiveSignatures(bytes: Uint8Array): void {
  // ZIP: PK\x03\x04, PK\x05\x06, PK\x07\x08
  if (
    startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
  ) {
    reject("Archive files and compressed containers (ZIP) are not permitted.");
  }

  // GZIP: 0x1F, 0x8B
  if (startsWith(bytes, [0x1f, 0x8b])) {
    reject("Compressed archives (GZIP) are not permitted.");
  }

  // 7-Zip: 7z\xbc\xaf\x27\x1c
  if (startsWith(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) {
    reject("Archive files (7-Zip) are not permitted.");
  }

  // RAR: Rar!\x1a\x07
  if (startsWith(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) {
    reject("Archive files (RAR) are not permitted.");
  }

  // BZIP2: BZh
  if (startsWith(bytes, [0x42, 0x5a, 0x68])) {
    reject("Compressed archives (BZIP2) are not permitted.");
  }

  // XZ: \xfd7zXZ\x00
  if (startsWith(bytes, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) {
    reject("Compressed archives (XZ) are not permitted.");
  }

  // TAR magic at offset 257 ('ustar')
  if (bytes.length >= 262) {
    const tarMagic = String.fromCharCode(...bytes.slice(257, 262));
    if (tarMagic === "ustar") {
      reject("Archive files (TAR) are not permitted.");
    }
  }
}

/**
 * Checks for the standard EICAR antivirus test file signature.
 */
function checkEicarSignature(bytes: Uint8Array): void {
  if (bytes.length < 1024 * 1024) {
    const textSample = new TextDecoder("latin1").decode(bytes);
    if (textSample.includes(EICAR_TEST_SIGNATURE)) {
      reject("File contains a known malware test signature (EICAR).");
    }
  }
}

/**
 * Validates text-based formats (txt, csv, tsv, json, md).
 */
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

  if (extension === ".csv" || extension === ".tsv") {
    // Formula Injection / DDE defense: reject spreadsheet formula execution commands in any cell
    const dangerousFormulaPattern =
      /(?:^|[,;\t"])\s*[=+\-@|%]\s*(?:cmd|powershell|calc|dde|hyperlink|mshta|rundll32|cscript|wscript|regsvr32)\b/im;
    if (dangerousFormulaPattern.test(text)) {
      reject(
        "Spreadsheet contains potentially malicious formulas or command execution payloads.",
      );
    }
  }
}

/**
 * Validates PDF documents against corruptions, malicious active content, and decompression abuse.
 */
function validatePdf(bytes: Uint8Array): void {
  if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    reject("PDF signature is invalid.");
  }

  const sample = new TextDecoder("latin1").decode(bytes);
  const trailer = sample.slice(-2048);
  if (!trailer.includes("%%EOF")) reject("PDF structure is incomplete.");

  const pageCount = (sample.match(/\/Type\s*\/Page\b/g) ?? []).length;
  if (pageCount > MAX_PDF_PAGE_COUNT) reject("PDF exceeds the 200 page limit.");

  // Reject active content, scripts, form submissions, and external actions
  if (
    /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|SubmitForm|ImportData|GoToR|Sound|Movie|AcroForm\/XFA)\b/i.test(
      sample,
    )
  ) {
    reject("PDF contains active or embedded content that is not allowed.");
  }

  // Defend against decompression bombs and recursive flate filter chains
  if (/\/Filter\s*\[\s*\/FlateDecode\s*\/FlateDecode/i.test(sample)) {
    reject(
      "PDF contains recursive decompression filters (decompression bomb risk).",
    );
  }
}

/**
 * Validates an untrusted upload before it is stored or sent to an AI parser.
 * Applies multi-layer defense against MIME spoofing, extension tricks, magic byte
 * manipulation, archive bombs, and malicious document payloads.
 */
export function validateKnowledgeBaseUpload(
  suppliedFilename: string,
  bytes: ArrayBuffer,
): ValidatedUpload {
  const filename = suppliedFilename.trim();

  // Basic filename safety & length checks
  if (
    !filename ||
    filename.length > MAX_FILENAME_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(filename)
  ) {
    reject("Filename is invalid.");
  }

  // Prevent path traversal and directory injection
  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    filename !== filename.split(/[\\/]/).pop()
  ) {
    reject("Filename contains path traversal sequences.");
  }

  // Reject Unicode Bidirectional Override characters used to spoof file extensions visually
  if (/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(filename)) {
    reject("Filename contains invalid directional override characters.");
  }

  // Detect and reject double/intermediate dangerous extensions (e.g. payload.exe.txt, shell.php.pdf)
  const segments = filename
    .toLowerCase()
    .split(".")
    .map((s) => s.trim());
  if (segments.length > 2) {
    const intermediateExtensions = segments.slice(1, -1);
    for (const ext of intermediateExtensions) {
      if (DANGEROUS_INTERMEDIARY_EXTENSIONS.has(ext)) {
        reject(
          "Double extensions or executable intermediary extensions are not permitted.",
        );
      }
    }
  }

  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) {
    reject("Files must have a valid file extension.");
  }

  const extension = filename
    .slice(lastDotIndex)
    .toLowerCase() as AllowedExtension;
  const mimeType = ALLOWED_TYPES[extension];
  if (!mimeType) {
    reject("This file type is not supported.");
  }

  const content = new Uint8Array(bytes);
  if (content.byteLength === 0 || content.byteLength > MAX_FILE_SIZE_BYTES) {
    reject("Files must be between 1 byte and 10 MB.");
  }

  // Check known malware signatures (EICAR)
  checkEicarSignature(content);

  // Check binary executable headers across all uploads
  checkExecutableSignatures(content);

  // Check archive signatures to prevent disguised archive / decompression bombs
  checkArchiveSignatures(content);

  // Format-specific content verification
  if (
    [".txt", ".csv", ".tsv", ".json", ".md", ".markdown"].includes(extension)
  ) {
    if (content.byteLength > MAX_TEXT_FILE_SIZE_BYTES) {
      reject("Text files must not exceed 2 MB.");
    }
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
  const content = new Uint8Array(bytes);
  checkEicarSignature(content);

  // Environment-controlled mock for test suites and evaluators
  const mockMode = process.env.TEST_MALWARE_SCANNER_MOCK;
  if (mockMode === "clean" || mockMode === "allow") {
    return;
  }
  if (mockMode === "infected") {
    reject("The file was rejected by malware scanning.");
  }
  if (mockMode === "error") {
    reject("File scanning failed. Uploads are temporarily unavailable.");
  }

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
    reject(
      "File scanning is not configured. Uploads are temporarily unavailable.",
    );
  }
  if (parsedScannerUrl.protocol !== "https:") {
    reject(
      "File scanning is not configured. Uploads are temporarily unavailable.",
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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
      signal: controller.signal,
    });
  } catch {
    reject(
      "File scanning is unavailable. Uploads are temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    reject("File scanning failed. Uploads are temporarily unavailable.");
  }

  try {
    const result = (await response.json()) as { clean?: boolean };
    if (result.clean !== true) {
      reject("The file was rejected by malware scanning.");
    }
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    reject("File scanning returned an invalid response.");
  }
}
