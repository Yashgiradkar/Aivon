# Aivon Security Policy & Architecture

This document specifies the security architecture, threat model, defensive controls, and operational procedures implemented across the Aivon AI Customer Support platform.

---

## 1. Security Architecture & Threat Model

Aivon is a multi-tenant platform composed of:
1. **Operator Dashboard (`apps/web`)**: Next.js 15, authenticated via Clerk JWT with strict organizational scoping.
2. **Customer Chat Widget (`apps/widget`)**: Next.js 15, session-based customer interaction embedded via iframe.
3. **Embeddable Script (`apps/embed`)**: Zero-dependency lightweight IIFE injecting isolated iframe.
4. **Backend Engine (`packages/backend`)**: Serverless Convex cloud runtime, ACID database, file storage, and integrated AI pipeline.

### Trust Boundaries & Auth Model

| Surface | Auth Model | Scope | Transport |
|---|---|---|---|
| **Operator Dashboard (`private/`)** | Clerk JWT session | `identity.orgId` enforced per function | HTTPS / WSS |
| **Customer Widget (`public/`)** | Ephemeral DB Contact Session (24h) | Bound to `organizationId` + `contactSessionId` | HTTPS / WSS |
| **System Operations (`system/`)** | Internal only | Invokable only by scheduler or server actions | Internal runtime |
| **External Webhooks** | Svix cryptographic signature / shared secret | Verified with timing-safe comparisons | HTTPS POST |

---

## 2. Multi-Tenant & Database Isolation

Convex enforces isolation at the application layer through consistent, audited access patterns:

1. **Dashboard Isolation (`private/` functions)**:
   - Every private query, mutation, and action retrieves `identity = await ctx.auth.getUserIdentity()`.
   - Rejects unauthenticated requests (`code: "UNAUTHORIZED"`).
   - Validates `identity.orgId` on all record lookups (`conversation.organizationId === orgId`).
   - All database updates enforce org-matching indices (`by_organization_id`, `by_org_and_status`).

2. **Customer Widget Isolation (`public/` functions)**:
   - Contact sessions are validated for expiration (`expiresAt < Date.now()`).
   - Every customer operation validates `conversation.contactSessionId === contactSession._id` and `conversation.organizationId === contactSession.organizationId`.
   - Prevents BOLA/IDOR by disallowing clients from supplying arbitrary conversation IDs without a matching session token.

3. **Knowledge Base & RAG Isolation**:
   - Vector embeddings are indexed in `@convex-dev/rag` with explicit `namespace: orgId`.
   - BM25 inverted lexical indices are built strictly per-tenant from `internal.system.ai.rag.corpus.getTenantCorpus`.
   - `MultiTenantRetrievalCache` prefixes all in-memory cache keys with `orgId:`.
   - `ChunkEmbeddingCache` content-addressable storage keys embeddings with `organizationId:chunkHash`, guaranteeing zero cross-tenant vector leakage.
   - `DocumentManifestStore` tracks revision manifests and SHA-256 page checksums strictly scoped per organization.
   - Guaranteed 0% cross-tenant data leakage across vector, BM25, semantic cache, and chunk embedding lookups.

4. **Secret Storage Isolation**:
   - AWS Secrets Manager keys adhere strictly to `tenant/{organizationId}/{service}` hierarchy.
   - Public APIs never return private API keys or server tokens.

---

## 3. API, Webhook, and File-Upload Security

### Webhook Verification
- **Clerk Webhooks (`/clerk-webhook`)**: Verified via Svix cryptographic signatures (`svix-id`, `svix-timestamp`, `svix-signature`). Payloads exceeding 1 MB are rejected with HTTP 413. Handles subscription lifecycle (`subscription.created`, `subscription.updated`, `subscription.active`, `subscription.pastDue`) and membership synchronizations.
- **Vapi Webhooks (`/vapi-webhook`)**: Protected by `VAPI_WEBHOOK_SECRET` evaluated via `timingSafeEqualString` to resist timing attacks. Voice search and transcription endpoints verify tenant organization and convex conversation ownership.

### Knowledge Base File Upload & Ingestion Pipeline Security

The RAG ingestion pipeline implements strict fail-closed defense-in-depth: **a file never reaches storage, document parsing, OCR, chunking, embedding, or indexing until it passes comprehensive structural validation and malware scanning.**

```mermaid
flowchart TD
    A[Untrusted File Upload] --> B[Tenant Auth & Active Subscription Gate]
    B --> C[Rate Limiter & Admission Control]
    C --> D[Filename & Traversal Defense: Basename, Length, RTL Spoofing, Double Extensions]
    D --> E[Binary Signature Inspection: Block PE/ELF/Mach-O/WASM/Shebang & Archives]
    E --> F[Malware Scanning: Pre-Scan EICAR + HTTPS ClamAV Fail-Closed]
    F -->|Pass| G[Convex Storage Blob Allocation]
    F -->|Fail| H[Reject 400 Bad Request: Never Stored]
    G --> I[Format Normalization & Text Extraction: PDF/MD/CSV/JSON/Images]
    I --> J[Indirect Prompt Injection Sanitizer: ModerationPipeline]
    J --> K[Namespace-Isolated RAG Indexing: namespace = orgId]
    I -->|Error| L[Storage Auto-Cleanup: Delete Orphaned Blob]
```

1. **Filename Sanitization & Extension Protection**:
   - Client-provided filenames and MIME types are treated as hostile untrusted input.
   - Rejects directory traversal sequences (`..`, `/`, `\`), null bytes (`\0`), ASCII control characters (`\x00-\x1F`), and Unicode Bidirectional Override characters (`\u202E`, `\u202D`) used to spoof extensions.
   - Maximum filename length capped at 120 characters.
   - **Double / Intermediate Extension Blocking**: Scans all intermediate segments between the base name and extension. Rejects files containing dangerous script/binary intermediate extensions (`.exe.txt`, `.php.pdf`, `.sh.csv`, `.bat.md`, `.ps1.json`, `.dll.txt`).

2. **File Signature & Magic Byte Verification**:
   - Validates authentic file signatures via `Uint8Array` byte headers:
     - PDF: `%PDF-` (`0x25, 0x50, 0x44, 0x46, 0x2D`) at byte 0.
     - PNG: `0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A`.
     - JPEG: `0xFF, 0xD8, 0xFF`.
     - WebP: RIFF container with `WEBP` signature at bytes 8-11.
   - **Disguised Executable Binary Rejection**: Regardless of claimed extension, all files are checked against executable magic bytes and rejected immediately:
     - Windows PE / DOS: `MZ` (`0x4D, 0x5A`).
     - Linux ELF: `\x7fELF` (`0x7F, 0x45, 0x4C, 0x46`).
     - Mach-O (32/64-bit big & little endian) and Java Bytecode (`0xCAFEBABE`).
     - WebAssembly bytecode: `\0asm` (`0x00, 0x61, 0x73, 0x6D`).
     - Shell Shebang headers: `#!` (`0x23, 0x21`).
   - **Disguised Archive & Decompression Bomb Detection**: Rejects disguised compressed containers:
     - ZIP: `PK\x03\x04`, `PK\x05\x06`, `PK\x07\x08`.
     - GZIP: `0x1F, 0x8B`.
     - 7-Zip: `7z\xbc\xaf\x27\x1c`.
     - RAR: `Rar!\x1a\x07`.
     - BZIP2: `BZh`.
     - XZ: `\xfd7zXZ\x00`.
     - TAR: `ustar` at offset 257.

3. **Format-Specific Content Hardening**:
   - **PDF Security**:
     - Strict `%%EOF` trailer verification.
     - Hard limit of 200 pages (`MAX_PDF_PAGE_COUNT`).
     - Active code detection: Blocks `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile`, `/RichMedia`, `/SubmitForm`, `/ImportData`, `/GoToR`, `/Sound`, `/Movie`, `/AcroForm/XFA`.
     - Recursive filter defense: Blocks decompression bombs (e.g., nested `/FlateDecode /FlateDecode` filter chains).
   - **Spreadsheet Security (CSV/TSV)**:
     - Formula Injection (DDE) prevention: Inspects every cell boundary for formula triggers (`=`, `+`, `-`, `@`, `|`, `%`) followed by execution keywords (`cmd`, `powershell`, `calc`, `dde`, `hyperlink`, `mshta`, `rundll32`, `cscript`, `wscript`).
   - **Text & Markdown Security**:
     - Enforces valid UTF-8 encoding; rejects null bytes and binary control characters.
     - Text/structured documents capped at 2 MB; total upload size capped at 10 MB.
     - Direct raw bytes extraction for Markdown (`.md`, `.markdown`) and JSON without unnecessary LLM overhead.
     - Strict JSON syntax parsing validation.

4. **Malware & Antivirus Protection**:
   - **Pre-Scan EICAR Detection**: Rapid local signature check for the standard EICAR test pattern (`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`).
   - **Remote Antivirus Scanner Integration**: Integrates with ClamAV / external scanning service via HTTPS POST. Requires valid bearer authentication and strict `{ "clean": true }` response.
   - **Fail-Closed Architecture**: If the scanner URL is unconfigured, unreachable, times out (10s abort controller), or returns non-200/infected status, uploads fail closed with HTTP 400 and are never written to disk or storage.

5. **Storage, Ingestion & Lifecycle Isolation**:
   - Ingestion State Machine: `Untrusted -> Validated -> Scanned -> Stored -> Extracted & Sanitized -> Indexed`.
   - On extraction or indexing error: Orphaned storage blobs are immediately deleted (`ctx.storage.delete(storageId)`).
   - Duplicate detection: Content hash (`contentHashFromArrayBuffer`) detects existing files; redundant storage blobs are immediately deleted.
   - RAG Namespace Scoping: All indexing is strictly partitioned by `namespace: orgId`.
   - Indirect Prompt Injection Defense: Extracted text is filtered through `ModerationPipeline.sanitizeRetrievedDocument` before chunking and embedding.

---

## 4. AI Agent, Prompt Injection & RAG Security

Aivon deploys a multi-stage defense-in-depth pipeline (`ModerationPipeline`):

```mermaid
flowchart TD
    A[Customer Spoken / Written Input] --> B[Sanitizer: Control Chars, Bounds, PII Redaction]
    B --> C{Harmful / Prompt Injection?}
    C -->|Critical / High Risk| D[Reject with 400 Bad Request]
    C -->|Pass| E[Context Manager: Sliding Window + Boundary Tags]
    E --> F[Hybrid Retrieval: BM25 + Vector]
    F --> G[Sanitize Retrieved Chunks: Neutralize Indirect Injections]
    G --> H[Tool Authorization Gate: Validate Args & Scope]
    H --> I[AI Agent Execution GPT-4o-mini]
    I --> J[Output Guardrails: Redact System Leak & Credentials]
    J --> K[Safe Response to Customer]
```

### Prompt Injection & Jailbreak Defense
- Direct injection heuristics block jailbreaks, system prompt overrides, and developer mode attempts.
- Indirect prompt injection protection scans external knowledge documents for malicious injection tags (e.g. `[System Message: ...]`, `<!-- ai-instruction -->`), neutralizing instructions with `[MALICIOUS_INSTRUCTION_REDACTED]`.
- User input is isolated using XML boundary tags (`<untrusted_user_input>`) to prevent delimiter spoofing.

### Tool Execution & Privilege Control
- AI tools (`search`, `escalateConversation`, `resolveConversation`) validate calling context through `ctx.threadId`.
- Conversation ownership is verified against tenant database before executing tool logic.
- Arguments are validated with Zod schemas and character limits (e.g., search queries bounded to 500 characters).

### Output Guardrails & Credential Leak Prevention
- Model outputs are inspected for system instruction disclosures and API key patterns (`sk-proj-`, AWS keys).
- Offending outputs are blocked and replaced with neutral support messaging.

---

## 5. Rate Limiting, Abuse & Cost Control

Aivon deploys a 3-tier distributed rate-limiting and quota architecture:

1. **Client / IP Rate Limiting**:
   - Contact session creation throttled to 5 requests per 60 seconds.
   - Keyed sliding windows for public endpoints (30 requests/min).
2. **Session Message Throttling**:
   - Active chat sessions bounded to 30 messages/minute.
   - Max messages per conversation capped via `widgetSettings` (default 20 messages).
3. **Tenant Distributed Quota Engine (`tenantRateLimits`)**:
   - Plan-based monthly token quotas: Free (50k), Pro (2M), Enterprise (50M).
   - Admission control reserves estimated tokens prior to LLM execution and reconciles actual token usage post-turn.
   - Throttles burst concurrency and blocks execution when monthly quotas are exhausted (`QUOTA_EXHAUSTED`).

---

## 6. Infrastructure, Secrets & Deployment

### Secret Management
- Zero plaintext API keys in client-accessible tables.
- BYOK (Bring Your Own Key) third-party integrations (Vapi, ElevenLabs) stored in AWS Secrets Manager with customer tenant path isolation.
- Public Vapi key retrieval (`public/secrets.ts`) validates tenant and returns only client-safe public keys.

### Browser Security Headers & CSP
- **Operator Dashboard (`apps/web`)**: Hardened Content Security Policy (`CSP`) with dynamic code evaluation (`'unsafe-eval'`) removed, `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, and `Cross-Origin-Resource-Policy: same-origin`.
- **Chat Widget (`apps/widget`)**: Hardened CSP restricting iframe embeds to secure origins (`frame-ancestors https:;`), `Strict-Transport-Security` with `preload`, `Cross-Origin-Opener-Policy: unsafe-none`, `Cross-Origin-Resource-Policy: cross-origin`, restricted camera/mic permissions, and trusted WebSocket connections to Convex and Vapi.
- **Embed Script (`apps/embed`)**: Hardened postMessage handler validating message origin and payload shape, immutable global API via `Object.freeze`, and strict position attribute validation to prevent CSS/DOM injection.

### CI/CD & Dependency Supply Chain Hardening
- **Lockfile Enforcement**: GitHub Actions CI strictly enforces `--frozen-lockfile` to prevent unexpected dependency mutations or supply-chain drift during automated builds.
- **Automated Vulnerability Scanning**: Integrated `pnpm audit --audit-level=high` step in CI pipeline.

### Centralized AI Audit Trail & RAG Data Lineage
- **Unified Observability Middleware (`AuditMiddleware`)**: Centralized interceptor capturing request initiation, authentication decisions, input moderation, hybrid retrieval, agent orchestration, model inference, and TTS speech synthesis across text chat, voice assistant (Vapi / ElevenLabs), operator responses, and travel workflows.
- **Deterministic RAG Lineage (`ragLineageRecords`)**: Complete data lineage linking user queries to retrieved evidence items (document ID, filename, exact page number, section, chunk ID, relevance score, format, and retrieval source).
- **Voice & Audio Traceability**: Common correlated trace ID (`tr_{channel}_{timestamp}_{entropy}`) linking speech input → transcription → retrieval → agent execution → ElevenLabs TTS formatting → audio output.
- **Tenant Isolation & Zero PII Leakage**: Audit events and lineage records are indexed by `organizationId`. Credit cards, SSNs, phone numbers, emails, and API keys are automatically masked before log persistence (`maskPIIForLogging`).
- **Asynchronous Persistence**: All database audit records are written asynchronously via Convex scheduler (`runAfter(0, ...)`), resulting in sub-millisecond overhead (~0.01ms) with zero impact on customer TTFB.

---

## 7. Vulnerability Remediation History

The following vulnerabilities were identified during security audits and remediated:

| ID | Finding | Severity | Affected Area | Resolution | Status |
|---|---|---|---|---|---|
| **SEC-01** | `script-src 'unsafe-eval'` in Dashboard CSP | High | `apps/web/next.config.mjs` | Removed `'unsafe-eval'`; runtime does not require eval | Fixed & Verified |
| **SEC-02** | Wildcard `frame-ancestors *` in Widget CSP | High | `apps/widget/next.config.mjs` | Restricted to `frame-ancestors https:;` preventing insecure embed | Fixed & Verified |
| **SEC-03** | CI using `--frozen-lockfile=false` | Medium | `.github/workflows/ci.yml` | Switched to `--frozen-lockfile` and added `pnpm audit` gate | Fixed & Verified |
| **SEC-04** | Demo auth client IP spoofing & unbounded keys | Medium | `apps/web/app/api/auth/demo/route.ts` | Sanitized IP extraction and bounded rate-limit key space | Fixed & Verified |
| **SEC-05** | Vapi Webhook end-of-call report tenant mismatch | Medium | `convex/http.ts` | Validates conversation exists and org matches before recording transcript | Fixed & Verified |
| **SEC-06** | Narrow indirect prompt injection pattern coverage | High | `convex/system/ai/security/moderationPipeline.ts` | Expanded from 4 to 21+ regex patterns covering role-flip, ChatML, Llama delimiters | Fixed & Verified |
| **SEC-07** | Travel voice assistant public route audit | Low | `apps/web/middleware.ts` | Verified demo public session model; CSRF & input boundary safeguards active | Audited & Verified |
| **SEC-09** | Missing HSTS `preload` directive | Low | Both `next.config.mjs` | Added `; preload` to `Strict-Transport-Security` header | Fixed & Verified |
| **SEC-10** | Missing COOP / CORP headers | Low | Both `next.config.mjs` | Added `same-origin` for web and `cross-origin` / `unsafe-none` for widget | Fixed & Verified |
| **SEC-11** | AWS Secrets Manager path traversal / arbitrary secret creation | High | `convex/lib/secrets.ts` | Added `assertSafeSecretName` enforcing `tenant/{orgId}/{service}` regex pattern | Fixed & Verified |
| **SEC-FIX-1** | Clerk Webhook Lifecycle Event Gap | High | `convex/http.ts` | Handled `subscription.created`, `subscription.active`, `subscription.pastDue`, and `subscription.deleted` | Fixed & Verified |
| **SEC-FIX-2** | Agent Availability Desync in Queue Completion | High | `convex/private/queue.ts` | `completeQueueEntry` now frees `queueEntry.assignedAgentId` | Fixed & Verified |
| **SEC-FIX-3** | BOLA / Ownership Gap in Voice Call Logs | High | `convex/private/queue.ts` | `getCallLogs` validates conversation and tenant ownership | Fixed & Verified |
| **SEC-FIX-4** | Typo in Error Code `UNAUTHORZIED` | High | `convex/private/conversations.ts` | Fixed typo to standard `UNAUTHORIZED` | Fixed & Verified |
| **SEC-FIX-5** | Missing Plugin Service in Query Validator | Medium | `convex/private/plugins.ts` | Added `elevenlabs` literal to `getOne` query validator | Fixed & Verified |
| **SEC-FIX-6** | Embed Script postMessage TypeError & DOM Tamper | High | `apps/embed/embed.ts` | Added null/type validation, bounded height, froze global API | Fixed & Verified |
| **SEC-FIX-7** | PII in Observability Telemetry | Medium | `convex/system/ai/observability/logger.ts` | Deep PII sanitization across structured log `details` objects | Fixed & Verified |
| **SEC-FIX-8** | System/Tool Internal Leak in Queue Summary | Medium | `convex/system/queue.ts` | Filtered out tool and system messages from customer handoff | Fixed & Verified |

---

## 8. OWASP Standards Compliance Matrix

| OWASP Standard | Requirement | Implementation in Aivon | Compliance Status |
|---|---|---|---|
| **OWASP Top 10 - A01:2021** | Broken Access Control | Clerk JWT org claims verified per function; widget sessions bound to org and checked for expiration | **Fully Compliant** |
| **OWASP Top 10 - A02:2021** | Cryptographic Failures | Webhook timing-safe comparison (`timingSafeEqualString`); HSTS preload; AWS Secrets Manager at rest | **Fully Compliant** |
| **OWASP Top 10 - A03:2021** | Injection | Convex parameterized schema; CSV formula injection neutralization; AWS secret path regex | **Fully Compliant** |
| **OWASP Top 10 - A04:2021** | Insecure Design | Bounded rate limiting; human confirmation gates for consequential actions (`confirmBooking`) | **Fully Compliant** |
| **OWASP Top 10 - A05:2021** | Security Misconfiguration | Strict CSP without `unsafe-eval`; frame-ancestors restricted to HTTPS; COOP/CORP enabled | **Fully Compliant** |
| **OWASP Top 10 - A06:2021** | Vulnerable & Outdated Components | Pinned dependencies via `pnpm-lock.yaml`; `pnpm audit` CI quality gate | **Fully Compliant** |
| **OWASP Top 10 - A07:2021** | Identification & Auth Failures | Multi-factor Clerk authentication; 24h ephemeral customer sessions; secure demo tokens | **Fully Compliant** |
| **OWASP Top 10 - A08:2021** | Software & Data Integrity Failures | Magic byte file signature validation (PDF, CSV, JSON, MD); Svix cryptographic webhook signatures | **Fully Compliant** |
| **OWASP Top 10 - A09:2021** | Security Logging & Monitoring | Sentry integration; structured audit trails; automated PII redaction on all telemetry | **Fully Compliant** |
| **OWASP Top 10 - A10:2021** | Server-Side Request Forgery | Outbound endpoints restricted to approved vendors; fail-closed malware scanner client | **Fully Compliant** |
| **OWASP API - API1:2023** | Broken Object Level Auth (BOLA) | Every database query and mutation verifies `organizationId` ownership | **Fully Compliant** |
| **OWASP API - API4:2023** | Unrestricted Resource Consumption | Token rate limiters (`checkAndAdmit`); 25MB file upload limit; 1000-page doc limit | **Fully Compliant** |
| **OWASP GenAI - LLM01:2026** | Direct Prompt Injection | Multi-pattern regex and suspicious token anomaly detection in `ModerationPipeline` | **Fully Compliant** |
| **OWASP GenAI - LLM02:2026** | Sensitive Info Disclosure | Output guardrails stripping API keys (`sk-proj-`), internal instructions, and AWS secrets | **Fully Compliant** |
| **OWASP GenAI - LLM04:2026** | Data & Model Poisoning | 21+ indirect prompt injection patterns neutralized in RAG chunks with `[MALICIOUS_INSTRUCTION_REDACTED]` | **Fully Compliant** |
| **OWASP GenAI - LLM06:2026** | Excessive Agency | Strict `ALLOWED_TOOLS` allowlist; input size limits; fail-closed tool authorization | **Fully Compliant** |
| **OWASP GenAI - LLM08:2026** | Vector & Embedding Weaknesses | Namespaced embeddings (`namespace: orgId`); org-prefixed semantic and chunk cache keys | **Fully Compliant** |
| **OWASP Agentic 2026** | Agent Authorization & Tool Guardrails | Tool execution contracts with argument size limits and server-side state enforcement | **Fully Compliant** |

---

## 9. Residual Risks & Recommended Infrastructure Operations

The following residual operational considerations pertain to external infrastructure beyond the application code boundary:

1. **AWS Secrets Manager IAM Policies**: Ensure the IAM role assigned to the backend execution environment has least-privilege permissions scoped only to `arn:aws:secretsmanager:<region>:<account>:secret:tenant/*`.
2. **Clerk Webhook Secret Rotation**: Periodically rotate Clerk signing secrets in production using Clerk's dual-secret rollout feature to eliminate downtime.
3. **External Antivirus Daemon**: For enterprise on-premise deployments, deploy a dedicated ClamAV REST container (`clamav/clamav:latest`) and configure `MALWARE_SCANNER_URL` to point to the internal cluster IP.
4. **Distributed Redis Rate Limiting**: If scaling the web dashboard across multiple stateless serverless regions, back the demo route limiter with Upstash Redis for shared global rate tracking.

---

## 10. Verification & Test Suite

The security controls are validated by automated test suites in `eval/tests/`:
- `owaspSecurityAudit.test.ts`: OWASP Top 10, GenAI LLM01/02/06, Agentic tool authorization, AWS secret traversal, and Next.js security headers.
- `securityAndGuardrails.test.ts`: Input sanitization, injection detection, PII masking, output guardrails, and upload validation.
- `securityHardening.test.ts`: Subscription status validation, safe ID checks, log details sanitization, embed postMessage guards, and transcript filtering.
- `uploadAndIngestionSecurity.test.ts`: Magic bytes file validation, malware scanning, CSV formula injection defense, and file size limits.
- `incrementalRagPipeline.test.ts`: Incremental chunking, diff engine, and 1000-page update benchmark without vector leakage.
- `redTeamSafety.test.ts`: Adversarial prompt injections, toxic input blocking, indirect document injection neutralization, and tool parameter bounds.
- `hybridRagAndBM25.test.ts`: Cross-tenant RAG isolation (verified 0% cross-tenant data leakage).
- `rateLimiting.test.ts`: Token quota enforcement and burst rate limiters.
- `queueWorkflow.test.ts`: Multi-agent queue atomic assignment and tenant boundary enforcement.

Run automated security validation:
```bash
pnpm test:security
```
Run full test suite:
```bash
pnpm test
```

---

## 11. Reporting Security Vulnerabilities

If you discover a security vulnerability within Aivon, please disclose it responsibly:
- **Email**: security@aivon.ai
- **Encryption**: Include your public GPG key if you require encrypted communication.
- **Response SLA**: Initial triage within 24 hours; remediation updates every 48 hours until resolved.
- Please do not submit public GitHub issues for security vulnerabilities.
