// ─────────────────────────────────────────────────────────────────────────────
// data.ts — All static data driving the Aivon Flagship section.
// Every feature here maps to real production code in packages/backend/convex/
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulationScenario {
  id: string;
  category: string;
  label: string;
  customerQuery: string;
  pipeline: {
    stage: string;
    title: string;
    detail: string;
    status: string;
    timing: string;
  }[];
  aiResponse: string;
  sourceNote: string;
  auditNote?: string;
  stats: {
    precision: string;
    latency: string;
    tenant: string;
    model: string;
  };
}

export const simulationScenarios: SimulationScenario[] = [
  {
    id: "hybrid-rag",
    category: "Hybrid RAG / BM25 + Dense",
    label: "Knowledge Retrieval",
    customerQuery: "What are the exact refund conditions for the Enterprise plan?",
    pipeline: [
      {
        stage: "CLASSIFY",
        title: "Query Router",
        detail: "Query contains 'refund conditions' and 'Enterprise plan' — classified as table_lookup and routed to Hybrid RRF.",
        status: "Strategy: hybrid_rrf",
        timing: "3ms",
      },
      {
        stage: "RETRIEVE",
        title: "Dense + BM25 Parallel",
        detail: "Dense vector search (cosine ≥ 0.82, namespace: org_acme_corp) and BM25 lexical search run concurrently via Promise.allSettled().",
        status: "Dense: 5 hits | BM25: 4 hits",
        timing: "41ms",
      },
      {
        stage: "FUSE",
        title: "Reciprocal Rank Fusion",
        detail: "RRF(k=60, denseWeight=1.0, bm25Weight=1.0) merges 9 candidates into top-4 evidence items with exact policy cross-validation.",
        status: "Fused: 4 items | Reranked",
        timing: "12ms",
      },
      {
        stage: "RESPOND",
        title: "Grounded Synthesis",
        detail: "Response generated strictly from EVD-1 with lineage recorded to ragLineageRecords.",
        status: "Lineage Recorded ✓",
        timing: "180ms",
      },
    ],
    aiResponse:
      "Per your Enterprise agreement (Billing Handbook v3.2, Section 7): Enterprise plans carry a 30-day money-back guarantee for annual subscriptions, pro-rated credits for mid-cycle seat changes, and no refunds for voice minute overages. Want me to pull the exact clause for your legal team?",
    sourceNote: "Answer grounded in Acme Corp knowledge base [EVD-1: Billing Handbook v3.2, Page 7, Section: Refund Policy].",
    auditNote: "Audit trail: traceId=tr_8f2a • Strategy: hybrid_rrf • latency: 236ms • Evidence: hasEvidence=true • RAG lineage stored.",
    stats: {
      precision: "94.6%",
      latency: "236ms",
      tenant: "org_acme_corp",
      model: "GPT-4o-mini",
    },
  },
  {
    id: "multimodal-upload",
    category: "Multimodal RAG / Document Ingestion",
    label: "Image + PDF Knowledge",
    customerQuery: "What does our Q3 revenue chart show? Can you explain the pricing table in the pitch deck?",
    pipeline: [
      {
        stage: "INGEST",
        title: "Multimodal Upload Security",
        detail: "MIME spoofing, magic bytes, EICAR, and double extensions validated on pitch_deck_q3.pdf across 10 pages.",
        status: "Upload Secure ✓",
        timing: "24ms",
      },
      {
        stage: "EXTRACT",
        title: "AI-Powered Document Parsing",
        detail: "GPT-4o parses PDF tables to Markdown and charts to structured blocks, with images analyzed via GPT-4o-mini.",
        status: "Parsed: 3 tables, 2 charts",
        timing: "2.1s",
      },
      {
        stage: "STRUCTURE",
        title: "Content Block Normalization",
        detail: "normalizeDocumentContent() types blocks into prose, table, and chart while SHA-256 deduplication prevents re-embedding.",
        status: "Dedup: SHA-256 ✓",
        timing: "15ms",
      },
      {
        stage: "RESPOND",
        title: "Chart + Table Answer",
        detail: "Retrieved chart block EVD-1 and table block EVD-2 synthesize response with indirect injection sanitized.",
        status: "contentType: chart + table",
        timing: "195ms",
      },
    ],
    aiResponse:
      "Your Q3 revenue chart shows 34% month-over-month growth in August, peaking at $420K. The pricing table from your pitch deck lists: Starter at $29/mo (2 agents), Growth at $99/mo (10 agents), Enterprise custom. Shall I extract the full CSV from the chart for your finance team?",
    sourceNote: "Extracted from pitch_deck_q3.pdf — chart blocks and table blocks parsed by GPT-4o vision pipeline.",
    auditNote: "Audit trail: traceId=tr_9c3b • Format: PDF+Image • Extraction: GPT-4o • Dedup: SHA-256 match=false • Lineage stored.",
    stats: {
      precision: "98.1%",
      latency: "2.3s",
      tenant: "org_acme_corp",
      model: "GPT-4o",
    },
  },
  {
    id: "escalation-queue",
    category: "Human Escalation + Queue",
    label: "Smart Escalation",
    customerQuery: "My API key was compromised and our production system is leaking customer data!",
    pipeline: [
      {
        stage: "MODERATE",
        title: "Input Safety Pipeline",
        detail: "ModerationPipeline.moderateInput() screens toxic patterns, prompt injection, and masks PII for urgent incident triage.",
        status: "Risk: high | Clean ✓",
        timing: "8ms",
      },
      {
        stage: "SEARCH",
        title: "Incident Runbook Lookup",
        detail: "Hybrid search scores incident runbook at 0.61 (below 0.75 autonomous threshold), triggering escalation.",
        status: "Confidence below threshold",
        timing: "54ms",
      },
      {
        stage: "ESCALATE",
        title: "AI Handoff Summary",
        detail: "ModerationPipeline authorizes escalateConversation and GPT-4o-mini generates a 4-bullet handoff summary from transcript.",
        status: "Priority: urgent | AI Summary ✓",
        timing: "380ms",
      },
      {
        stage: "QUEUE",
        title: "FIFO Priority Matching",
        detail: "FIFO priority matcher enqueues request with stale heartbeat cleanup and assigns operator via matchAndAssign().",
        status: "Queue pos: 1 | ETA: ~3min",
        timing: "12ms",
      },
    ],
    aiResponse:
      "I've escalated this immediately as urgent — this is classified as a production security incident. A security specialist is being connected now (estimated wait: ~3 minutes). I've prepared a summary of the incident for them so you won't need to repeat yourself.",
    sourceNote: "Escalation logged: priority=urgent, aiSummary generated from 10-message transcript, assigned to next available agent.",
    auditNote: "Audit trail: traceId=tr_7d1f • Event: escalateConversation • Tool authorized ✓ • Queue status: waiting → accepted • Operator notified.",
    stats: {
      precision: "N/A",
      latency: "454ms",
      tenant: "org_acme_corp",
      model: "GPT-4o-mini",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITIES — 10 deep-dives, each backed by real code
// ─────────────────────────────────────────────────────────────────────────────

export interface Capability {
  id: string;
  icon: string;
  punchline: string;
  heading: string;
  subheading: string;
  body: string;
  techDetails: string[];
  realCodeNote: string;
  badge?: string;
}

export const tenCapabilities: Capability[] = [
  {
    id: "hybrid-rag",
    icon: "⚡",
    punchline: "Don't wonder where the answer came from. We log every piece of evidence.",
    heading: "Hybrid RAG with Full Audit Trail",
    subheading: "Dense vectors + BM25 lexical search + RRF fusion — every retrieval recorded.",
    body: "Most RAG is a black box. Aivon stores a ragLineageRecord for every response: documents, page, chunk, strategy, and whether evidence existed. Query any conversation's lineage from the dashboard.",
    techDetails: [
      "Hybrid Reciprocal Rank Fusion (RRF, k=60) merging dense cosine similarity + BM25 lexical rankings",
      "Query router classifies intent (table_lookup / chart_metrics / prose) and routes to optimal strategy",
      "Degraded-mode fallback: dense→BM25 or BM25→dense when one engine returns 0 results",
      "Exact identifier constraint filtering — policy codes must appear verbatim in evidence",
      "ragLineageRecords table stores: evidenceId, documentName, page, chunk, score, retrievalSource per response",
      "aiAuditEvents table captures every pipeline stage: latency, tokens, model, status (success/failed/blocked)",
      "getAuditSummary() exposes org-scoped citation rate, avg latency, channel breakdown",
    ],
    realCodeNote: "system/audit.ts → recordLineage() | system/ai/rag/unifiedSearch.ts → executeUnifiedRetrieval()",
    badge: "94.6% Precision@5",
  },
  {
    id: "multimodal-rag",
    icon: "📄",
    punchline: "PDFs, images, charts, and tables parsed with structural fidelity.",
    heading: "Multimodal Document Ingestion",
    subheading: "Any format. Structured extraction. Deduplication built in.",
    body: "GPT-4o and GPT-4o-mini extract structured tables, charts, and typed blocks from 10 formats. SHA-256 deduplication stops duplicate embeddings.",
    techDetails: [
      "Supported formats: PDF (200-page max), PNG, JPEG, WebP, TXT, CSV, TSV, JSON, Markdown",
      "GPT-4o PDF vision parser preserves headings, tables, charts, lists with structural fidelity",
      "GPT-4o-mini image analyzer extracts text, table cells, chart axes and data points",
      "normalizeDocumentContent() classifies and types each content block from extracted markdown",
      "SHA-256 content deduplication — identical content is never re-embedded into the vector index",
      "ModerationPipeline.sanitizeRetrievedDocument() strips indirect injection patterns before indexing",
      "contentType tagging (table / chart / structured_data / prose) enables intent-aware retrieval",
    ],
    realCodeNote: "lib/extractTextContent.ts → extractTextContent() | system/ai/rag/structure/documentParser.ts",
    badge: "10 File Formats",
  },
  {
    id: "upload-security",
    icon: "🛡️",
    punchline: "We inspect magic bytes, not file extensions.",
    heading: "Defense-in-Depth Upload Security",
    subheading: "MIME spoofing. Magic byte validation. Archive bombs. EICAR. All blocked.",
    body: "A 7-layer pipeline screens binary headers, archive bombs, EICAR signatures, BiDi overrides, and CSV formula injections before storage.",
    techDetails: [
      "Magic byte validation: DOS/PE (MZ), ELF (0x7F 45 4C 46), Mach-O (4 variants), WebAssembly, shebang (#!)",
      "Archive bomb prevention: ZIP, GZIP, 7-Zip, RAR, BZIP2, XZ, TAR (offset 257 magic) all blocked",
      "EICAR antivirus test signature detection on all uploads < 1MB",
      "Unicode BiDi override attack prevention (directional override character spoofing blocked)",
      "Double/intermediate extension rejection: payload.exe.txt, shell.php.pdf all blocked",
      "CSV formula injection defense: =cmd, +HYPERLINK, @DDE, PowerShell payloads rejected",
      "Path traversal prevention: ../ sequences, backslash injection, bare separator chars rejected",
    ],
    realCodeNote: "lib/uploadSecurity.ts → validateKnowledgeBaseUpload() | checkExecutableSignatures() | checkArchiveSignatures()",
    badge: "OWASP Compliant",
  },
  {
    id: "audit-logs",
    icon: "🔍",
    punchline: "Every AI decision is an audit event. Zero black boxes.",
    heading: "AI Audit Trail & RAG Data Lineage",
    subheading: "Complete observability over what the AI retrieved, used, and said.",
    body: "aiAuditEvents tracks latency, tokens, cost, and stage telemetry. ragLineageRecords grounds responses in verified page and chunk evidence.",
    techDetails: [
      "aiAuditEvents: traceId, channel (chat/voice/operator/system), stage, status, model, latencyMs, inputTokens, outputTokens, costUsd",
      "ragLineageRecords: userQuery, effectiveStrategy, retrievedEvidence[] with evidenceId/documentId/page/chunk/score/snippet",
      "PII masking via maskPIIForLogging() before any error text is stored",
      "Org-scoped queries: all lineage reads verify organizationId === orgId before returning data",
      "getAuditSummary() aggregates: citationRate, avgLatencyMs, voiceCount, chatCount across last 100 responses",
      "getLineageByConversation() exposes per-conversation evidence chain for operator inspection",
      "Audit events cover: success / failed / warning / blocked statuses for moderation outcomes",
    ],
    realCodeNote: "system/audit.ts → recordAuditEvent() + recordLineage() | private/audit.ts → getAuditSummary()",
    badge: "Full Lineage",
  },
  {
    id: "queue",
    icon: "👥",
    punchline: "AI steps aside gracefully when human judgment is required.",
    heading: "Priority Queue & Smart Handoff",
    subheading: "FIFO + priority weighting + AI-generated handoff summaries + stale entry cleanup.",
    body: "Weighted FIFO routing matches agents atomically, while GPT-4o-mini drafts a 4-bullet transcript summary so customers never repeat themselves.",
    techDetails: [
      "FIFO queue with priority weights: urgent (3) > high (2) > normal (1) → then joinedAt ascending",
      "matchAndAssign(): atomic reservation of customer + agent pair in a single Convex mutation",
      "generateSummary(): GPT-4o-mini summarizes conversation transcript into 3-4 bullet handoff notes",
      "Transcript sanitized through ModerationPipeline before being sent to summarizer (untrusted data handling)",
      "recalculatePositions(): position + estimatedWaitSeconds recalculated on every queue change",
      "cleanupStaleEntries(): heartbeat-based expiry removes waiting entries inactive > 2 minutes",
      "supportCalls record created on match, linking queueEntry, conversationId, contactSessionId, agentId",
    ],
    realCodeNote: "system/queue.ts → enqueue() + matchAndAssign() + generateSummary() + cleanupStaleEntries()",
    badge: "Zero Repeat Yourself",
  },
  {
    id: "ai-security",
    icon: "🔒",
    punchline: "Scans inputs, retrieved documents, and tool calls for threats.",
    heading: "Multi-Layer AI Security & Moderation",
    subheading: "Input guardrails + indirect injection detection + tool authorization + output moderation.",
    body: "Six-stage defense scans inputs, sanitizes retrieved chunks using 20+ OWASP patterns, authorizes tools fail-closed, and redacts credential leaks.",
    techDetails: [
      "TOXIC_PATTERNS: suicide/self-harm, bomb-making, exploit/DDOS references rejected at input stage",
      "20+ INDIRECT_INJECTION_PATTERNS: role-flip jailbreaks, delimiter injection (<|im_start|>system, <<SYS>>, [INST]), exfiltration attempts",
      "ModerationPipeline.sanitizeRetrievedDocument() scrubs every knowledge chunk before AI sees it",
      "authorizeToolCall() fails-closed: only search/escalateConversation/resolveConversation allowed",
      "Output moderation: system prompt leakage patterns, OpenAI key patterns (sk-...), AWS credential patterns blocked",
      "sanitizeUserInput() strips HTML/script tags, null bytes, control characters before processing",
      "maskPIIForLogging() removes emails, phone numbers, card-like patterns from error logs",
    ],
    realCodeNote: "system/ai/security/moderationPipeline.ts → ModerationPipeline | system/ai/security/sanitizer.ts",
    badge: "OWASP LLM Top 10",
  },
  {
    id: "memory",
    icon: "🧠",
    punchline: "Persistent memory across sessions with cryptographic tenant isolation.",
    heading: "Customer Memory System",
    subheading: "Semantic + episodic + entity memory with per-org isolation and content deduplication.",
    body: "Semantic, episodic, and entity memories maintain customer context across sessions with SHA-256 deduplication and organization-scoped boundaries.",
    techDetails: [
      "Three memory types: semantic (365d TTL), episodic (90d TTL), entity (180d TTL)",
      "upsertMemory(): SHA-256 content hash deduplication — identical memory refreshes TTL, changed content supersedes",
      "Memory validation: type/key/content/confidence validated before write",
      "getActiveCustomerMemories(): filters expired entries at query time (expiresAt > now)",
      "Full org isolation: by_org_and_customer index ensures cross-org memory leakage is impossible",
      "Memory status machine: active → superseded (on update)",
      "Provenance tracking: conversationId, source, extractedAt stored per memory entry",
    ],
    realCodeNote: "system/memory.ts → upsertMemory() + getActiveCustomerMemories() | system/ai/memory/memoryManager.ts",
    badge: "Cross-Session Context",
  },
  {
    id: "orchestration",
    icon: "🔗",
    punchline: "Multi-step workflows tracked with idempotency and stateful traces.",
    heading: "Multi-Agent Orchestration Layer",
    subheading: "Stateful execution tracking with idempotency keys and step-level result storage.",
    body: "Orchestration engine tracks state machines, execution plans, and step results with idempotency keys preventing duplicate operations.",
    techDetails: [
      "orchestrationExecutions table: idempotencyKey, routingCategory, executionPlan, stepResults (JSON), status",
      "recordExecutionStart(): checks existing by idempotencyKey before creating — prevents duplicates",
      "recordExecutionComplete(): patches status, stepResults, finalResponse, latencyMs, totalTokensUsed, completedAt",
      "Status machine: running → completed | escalated | waiting_for_approval | failed | cancelled",
      "Multi-channel support: chat / voice / operator orchestration contexts",
      "Step results stored as serialized JSON — full execution trace queryable per conversation",
    ],
    realCodeNote: "system/orchestrations.ts → recordExecutionStart() + recordExecutionComplete()",
    badge: "Idempotent Workflows",
  },
  {
    id: "voice",
    icon: "🎙️",
    punchline: "Real-time voice sharing the exact same RAG and security rails.",
    heading: "Voice AI with WebRTC",
    subheading: "Vapi-powered real-time voice with the same RAG, security, and audit trail as chat.",
    body: "Vapi WebRTC integration executes unified hybrid retrieval, ambiguous identifier disambiguation, and speech-specific formatting with real-time audit logging.",
    techDetails: [
      "Vapi WebRTC voice sessions with real-time conversation state via Convex subscriptions",
      "executeUnifiedRetrieval() supports source='voice' — same hybrid RAG, different response formatting",
      "detectAmbiguousVoiceIdentifier() catches spoken policy numbers that may be incomplete/garbled",
      "speechFormattedResponse stored separately from text response in ragLineageRecords",
      "voiceMetadata in lineage: provider, voiceId, modelId, audioDurationSeconds",
      "vapiWebhook.ts handles call-status events: initiating → active → ended → completed",
      "Voice queries share the same ModerationPipeline and audit trail as chat",
    ],
    realCodeNote: "system/vapiWebhook.ts | system/ai/rag/unifiedSearch.ts (source='voice' path)",
    badge: "40% Faster Drafting",
  },
  {
    id: "multitenant",
    icon: "🏢",
    punchline: "Tenant isolation enforced at database, vector, and secret tiers.",
    heading: "Production Multi-Tenancy",
    subheading: "Org-scoped RAG namespaces, JWT-verified access, and AWS Secrets Manager per-tenant keys.",
    body: "Every vector search enforces namespace: orgId, queries verify JWT organization identity, and API keys live in tenant-isolated AWS Secrets Manager paths.",
    techDetails: [
      "rag.search() and rag.add() always pass namespace: orgId — cross-tenant vector leakage is structurally impossible",
      "Every private query: ctx.auth.getUserIdentity() → orgId check → conversation.organizationId === orgId",
      "AWS Secrets Manager pattern: tenant/{organizationId}/{service} for per-tenant external API keys",
      "Public functions (widget): contactSession JWT with 24h expiry, auto-refresh < 4h remaining",
      "Private functions (dashboard): Clerk JWT with organization membership verification",
      "Session validation: expiresAt < Date.now() rejects expired sessions with UNAUTHORIZED error",
      "ConvexError codes: UNAUTHORIZED / NOT_FOUND / BAD_REQUEST — consistent across all functions",
    ],
    realCodeNote: "system/ai/rag.ts (namespace: orgId) | lib/secrets.ts | public/contactSessions.ts",
    badge: "Zero Cross-Tenant Leakage",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM → SOLUTION STEPS (Why This Exists)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProblemSolutionStep {
  problem: string;
  problemDetail: string;
  arrow: string;
  solution: string;
  solutionDetail: string;
  codeRef: string;
}

export const problemSolutionSteps: ProblemSolutionStep[] = [
  {
    problem: "Generic AI isn't your company's knowledge.",
    problemDetail: "Generic LLM knowledge isn't your company's knowledge. Hallucinations destroy trust.",
    arrow: "→",
    solution: "Hybrid RAG with Audit Trail",
    solutionDetail: "Dense vectors, BM25, and RRF fusion cite source document, page, and chunk in ragLineageRecords.",
    codeRef: "unifiedSearch.ts → executeUnifiedRetrieval()",
  },
  {
    problem: "Knowledge arrives in every format.",
    problemDetail: "PDFs, images, charts, tables, and CSVs lose critical structure in raw text extraction.",
    arrow: "→",
    solution: "GPT-4o Multimodal Parser",
    solutionDetail: "Extracts Markdown tables, structured chart blocks, and typed content with SHA-256 deduplication.",
    codeRef: "extractTextContent.ts → GPT-4o PDF + GPT-4o-mini image",
  },
  {
    problem: "Some answers must be exact.",
    problemDetail: "AI that never escalates is unsafe. Confidence thresholds and edge cases require humans.",
    arrow: "→",
    solution: "Smart Escalation + Priority Queue",
    solutionDetail: "FIFO queue with priority weighting and AI-generated 4-bullet handoff summaries.",
    codeRef: "system/queue.ts → enqueue() + generateSummary()",
  },
  {
    problem: "Every upload is a suspect.",
    problemDetail: "Executables masked as PDFs, formula injection in CSVs, and archive bombs threaten systems.",
    arrow: "→",
    solution: "7-Layer Upload Security",
    solutionDetail: "Magic byte checks, EICAR detection, archive blocking, BiDi prevention, and formula sanitization before storage.",
    codeRef: "uploadSecurity.ts → validateKnowledgeBaseUpload()",
  },
  {
    problem: "If it can't be audited, it can't ship.",
    problemDetail: "Without verifiable retrieval records, teams cannot explain or trust model responses.",
    arrow: "→",
    solution: "Full AI Audit Trail",
    solutionDetail: "Pipeline events logged to aiAuditEvents and citations stored in ragLineageRecords with masked PII.",
    codeRef: "system/audit.ts → recordAuditEvent() + recordLineage()",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE NODES (Core System Diagram)
// ─────────────────────────────────────────────────────────────────────────────

export interface ArchitectureNode {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  tech: string;
  description: string;
  details: string;
}

export const architectureNodes: ArchitectureNode[] = [
  {
    id: "widget",
    category: "Entrypoint",
    title: "Embedded Widget",
    subtitle: "End-User Web Interface",
    tech: "Vite IIFE + Next.js 15",
    description: "Framework-agnostic client embed script injecting an isolated iframe with Jotai state transitions.",
    details: "Zero npm runtime dependencies on host page with a postMessage iframe bridge.",
  },
  {
    id: "session",
    category: "Authentication",
    title: "Contact Session",
    subtitle: "Tenant & Session Verification",
    tech: "Public Convex Mutations + JWT",
    description: "Validates tenant scoping, establishes unguessable contactSession IDs, and manages token refresh.",
    details: "Enforces 24-hour expiration thresholds and rate-limited admission checks before conversations begin.",
  },
  {
    id: "realtime",
    category: "Persistence",
    title: "Real-Time Bus",
    subtitle: "Convex Reactive Engine",
    tech: "Convex Realtime Subscriptions",
    description: "Sub-50ms reactive WebSocket data layer synchronizing conversations across widgets and dashboards.",
    details: "Serverless mutations update relational state with optimistic client updates and zero polling.",
  },
  {
    id: "ai-agent",
    category: "Intelligence",
    title: "AI Support Agent",
    subtitle: "Stateful Agentic Core",
    tech: "GPT-4o-mini + @convex-dev/agent",
    description: "Autonomous orchestrator managing knowledge retrieval, tool evaluation, handoff dispatch, and resolution.",
    details: "Enforces conversation state machines: unresolved to escalated to resolved.",
  },
  {
    id: "hybrid-rag",
    category: "Knowledge",
    title: "Hybrid RAG Engine",
    subtitle: "Dense + BM25 Reciprocal Rank Fusion",
    tech: "text-embedding-3-small + In-Process BM25",
    description: "Multi-tenant vector namespace search merged with lexical BM25 token matching for exact identifiers.",
    details: "Executes RRF(k=60) candidate fusion with degraded-mode fallback and automated injection redaction.",
  },
  {
    id: "audit",
    category: "Observability",
    title: "Audit & Lineage Trail",
    subtitle: "Deterministic Grounding Ledger",
    tech: "aiAuditEvents + ragLineageRecords",
    description: "Centralized provenance tracking documenting retrieval scores, source chunks, confidence ratings, and tool dispatches.",
    details: "Immutable audit ledger enabling granular operator drill-downs and empirical benchmarks.",
  },
  {
    id: "queue",
    category: "Escalation",
    title: "Priority Queue",
    subtitle: "Human Handoff & Dispatch",
    tech: "Atomic Convex Matcher + FIFO Weighting",
    description: "Deterministic handoff engine with automatic AI summarization for zero-repetition operator transfers.",
    details: "Atomic reservation prevents double-booking while heartbeats purge orphaned slots after 2 minutes.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE RAILS (Core System Diagram - Bottom Rails)
// ─────────────────────────────────────────────────────────────────────────────

export interface InfraRail {
  title: string;
  badge: string;
  desc: string;
}

export const infrastructureRails: InfraRail[] = [
  {
    title: "Multi-Tenant Data Isolation",
    badge: "Hard Boundary",
    desc: "Hard boundary. namespace: orgId on every vector op. Tenant verified on every private query.",
  },
  {
    title: "Authentication & Identity",
    badge: "Clerk + JWT",
    desc: "Clerk JWT for operators. Signed session tokens for customers.",
  },
  {
    title: "API Key Vault",
    badge: "AWS Secrets Manager",
    desc: "Per-tenant secrets in AWS Secrets Manager, under tenant/{orgId}/.",
  },
  {
    title: "OWASP AI Security",
    badge: "Multi-Layer Guard",
    desc: "20+ injection signatures, magic-byte checks, formula stripping.",
  },
  {
    title: "Reactive Backend Bus",
    badge: "Zero Polling",
    desc: "Zero polling. WebSocket-driven cache invalidation.",
  },
  {
    title: "Full-Stack Observability",
    badge: "Audited Ledger",
    desc: "Every AI run logs model, latency, and exact citations.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE LAYERS (Architecture Showcase - 5 Layers)
// ─────────────────────────────────────────────────────────────────────────────

export interface ArchitectureLayerItem {
  title: string;
  desc: string;
}

export interface ArchitectureLayer {
  id: string;
  layer: number;
  name: string;
  badge: string;
  desc: string;
  items: ArchitectureLayerItem[];
}

export const architectureLayers: ArchitectureLayer[] = [
  {
    id: "layer-1",
    layer: 1,
    name: "LAYER 01: Client & Presentation Tier",
    badge: "Zero-Dependency Embed",
    desc: "Delivers responsive interfaces across all device viewports while strictly guarding host page performance and isolation boundaries.",
    items: [
      {
        title: "Next.js 15 Operator Dashboard",
        desc: "Server-side rendered operator workstation with Clerk organization gating, real-time message feeds, and RAG lineage inspection.",
      },
      {
        title: "Next.js 15 Chat Widget",
        desc: "Isolated customer chat experience with Jotai atomic state management, WebRTC voice integration, and session auto-recovery.",
      },
      {
        title: "Standalone Embed Script (IIFE)",
        desc: "Vanilla TypeScript script bundle (zero npm runtime dependencies) that dynamically injects the iframe bridge and floating launcher.",
      },
      {
        title: "Landing & Portfolio Showcase",
        desc: "Interactive Vite 5 + React 19 product exploration sandbox providing architectural transparency and live execution simulations.",
      },
    ],
  },
  {
    id: "layer-2",
    layer: 2,
    name: "LAYER 02: API Gateway & Tenant Security Tier",
    badge: "Cryptographic Boundary",
    desc: "Enforces strict access control, tenant isolation, and session authentication before requests reach application business logic.",
    items: [
      {
        title: "Public Convex Function Surface",
        desc: "Public-facing endpoints for widget clients, guarded by rate limits, input sanitization, and 24-hour contact session tokens.",
      },
      {
        title: "Private Clerk-Authenticated APIs",
        desc: "Protected management operations verifying organization membership claims and caller identity on every database query.",
      },
      {
        title: "Internal System Dispatcher",
        desc: "Isolated serverless mutations and actions inaccessible from clients, dedicated to AI scheduling and queue orchestration.",
      },
      {
        title: "HTTP Webhook Receivers",
        desc: "Svix-verified Clerk subscription billing receivers and Vapi WebRTC call status handlers.",
      },
    ],
  },
  {
    id: "layer-3",
    layer: 3,
    name: "LAYER 03: AI Agent & Retrieval Tier",
    badge: "Agentic State Machine",
    desc: "Multi-turn reasoning, dynamic tool dispatch, and precision hybrid grounding.",
    items: [
      {
        title: "Stateful Support Agent",
        desc: "GPT-4o-mini agent with persistent thread memory, conversation state machine enforcement, and tool execution boundaries.",
      },
      {
        title: "Hybrid Retrieval Engine (RRF)",
        desc: "Combines 1536-dim dense vector search with in-process tenant BM25 lexical ranking via Reciprocal Rank Fusion (k=60).",
      },
      {
        title: "Multimodal Document Ingestion",
        desc: "Vision-powered extraction transforming PDFs, tables, charts, and images into normalized Markdown blocks with SHA-256 deduplication.",
      },
      {
        title: "Query Classification & Routing",
        desc: "Intent-aware query router directing questions to dense search, lexical search, or hybrid RRF based on identifier characteristics.",
      },
    ],
  },
  {
    id: "layer-4",
    layer: 4,
    name: "LAYER 04: Security & Moderation Pipeline",
    badge: "Defense-in-Depth",
    desc: "Protects LLMs, databases, and users against prompt injection, harmful content, malicious uploads, and credential leakage.",
    items: [
      {
        title: "Multi-Stage Moderation Pipeline",
        desc: "Scans inbound customer queries for toxicity, prompt injection, and jailbreak patterns before model processing.",
      },
      {
        title: "Indirect Prompt Injection Redaction",
        desc: "Sanitizes retrieved knowledge chunks using 20+ OWASP GenAI patterns, neutralizing hostile instructions embedded in documents.",
      },
      {
        title: "7-Layer Binary Upload Security",
        desc: "Enforces magic byte validation for DOS/PE, ELF, Mach-O, archive bomb prevention, EICAR antivirus scans, and CSV formula stripping.",
      },
      {
        title: "Output & Credential Leak Guard",
        desc: "Redacts system instructions, API keys, and sensitive tokens from model outputs before they reach the user.",
      },
    ],
  },
  {
    id: "layer-5",
    layer: 5,
    name: "LAYER 05: Data, Queue & Infrastructure Tier",
    badge: "Deterministic Persistence",
    desc: "Handles atomic transactional storage, real-time message sync, operator queue matching, and cloud secrets.",
    items: [
      {
        title: "Convex Reactive Database",
        desc: "ACID-compliant serverless database providing real-time query subscriptions and automatic cache invalidation.",
      },
      {
        title: "Deterministic RAG Lineage Store",
        desc: "Stores full evidence citations, document identifiers, chunk numbers, and retrieval scores for every AI answer.",
      },
      {
        title: "Atomic FIFO Support Queue",
        desc: "Priority-weighted customer matching with automated AI handoff summaries and 2-minute stale entry expiration.",
      },
      {
        title: "AWS Secrets Manager Vault",
        desc: "Encrypted credential storage separating third-party API keys into tenant-specific paths.",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ENGINEERING DECISIONS (Decisions & Stack Section)
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineeringDecision {
  title: string;
  challenge: string;
  decision: string;
  why: string;
  codeRef: string;
}

export const engineeringDecisionsCards: EngineeringDecision[] = [
  {
    title: "Hybrid RRF beats pure dense search",
    challenge: "Dense vector search alone fails on exact policy codes like TEST-POL-482731 requiring exact lexical matching.",
    decision: "Hybrid Reciprocal Rank Fusion combines dense search and BM25 with query routing to suppress dense fallback when exact identifiers match.",
    why: "BM25 catches exact matches vector search misses, yielding 94.6% Precision@5 on labeled benchmarks.",
    codeRef: "system/ai/rag/unifiedSearch.ts",
  },
  {
    title: "Magic bytes over MIME trust",
    challenge: "File extensions and MIME types are attacker-controlled; a .pdf with an ELF header is an executable.",
    decision: "Inspect the first 12 bytes of every upload against known binary signatures for executables, archives, and formats before storage.",
    why: "MIME spoofing is trivial; binary inspection verifies true file contents.",
    codeRef: "lib/uploadSecurity.ts → checkExecutableSignatures()",
  },
  {
    title: "Audit is a feature, not a log",
    challenge: "Without a lineage trail, teams cannot verify or explain why the AI generated a specific response.",
    decision: "Every generation writes an aiAuditEvent for telemetry and a ragLineageRecord for exact source evidence.",
    why: "Enterprise operators and compliance teams require full explainability for model outputs.",
    codeRef: "system/audit.ts → recordAuditEvent() + recordLineage()",
  },
  {
    title: "Treat retrieved documents as hostile",
    challenge: "Untrusted knowledge base documents can embed indirect prompt injections designed to hijack the agent.",
    decision: "sanitizeRetrievedDocument() screens 20+ OWASP LLM02 patterns on every chunk before evidence synthesis.",
    why: "Indirect injection via RAG is an active threat; scanning retrieved content eliminates malicious prompt hijacking.",
    codeRef: "system/ai/security/moderationPipeline.ts → sanitizeRetrievedDocument()",
  },
  {
    title: "Handoffs arrive with a summary",
    challenge: "Human operators lose time reading lengthy transcripts when handling escalated conversations.",
    decision: "On enqueue(), generateSummary() triggers GPT-4o-mini to draft a 3-4 bullet handoff summary.",
    why: "Zero-explanation handoff eliminates customer repetition and prepares operators immediately upon pickup.",
    codeRef: "system/queue.ts → generateSummary()",
  },
  {
    title: "Same document, one vector",
    challenge: "Re-uploading existing documents wastes vector compute and creates duplicate retrieval entries.",
    decision: "Compute a SHA-256 hash of normalized content and skip embedding if an identical record exists.",
    why: "Content hashing keeps vector indices clean and prevents score pollution from duplicates.",
    codeRef: "system/memory.ts → hashContent() | private/files.ts",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROOF METRICS (Proof & Mindset Section)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProofMetric {
  type: string;
  value: string;
  label: string;
  sub: string;
}

export const proofMetrics: ProofMetric[] = [
  {
    type: "EMPIRICAL",
    value: "94.6%",
    label: "RAG Precision@5",
    sub: "Hybrid RRF evaluated against labeled test set with exact policy recall.",
  },
  {
    type: "ARCHITECTURAL",
    value: "7 Layers",
    label: "Upload Inspection",
    sub: "Binary magic bytes, archive bombs, EICAR scans, BiDi overrides, and formula stripping.",
  },
  {
    type: "ALIGNMENT",
    value: "20+ Rules",
    label: "Injection Filters",
    sub: "OWASP LLM02 signatures screened across inputs and retrieved knowledge chunks.",
  },
  {
    type: "LEDGER",
    value: "2 Records",
    label: "Per Generation",
    sub: "aiAuditEvent telemetry and ragLineageRecord citations written per turn.",
  },
  {
    type: "COVERAGE",
    value: "10 Types",
    label: "Multimodal Parsing",
    sub: "PDF, PNG, JPEG, WebP, TXT, CSV, TSV, JSON, MD with table and chart extraction.",
  },
  {
    type: "OPERATIONAL",
    value: "40%",
    label: "Drafting Speedup",
    sub: "Reduced human operator drafting time via AI-assisted context summaries.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ENGINEER PILLARS (Mindset Section)
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineerPillar {
  num: string;
  title: string;
  summary: string;
  detail: string;
  microLabel: string;
}

export const engineerPillars: EngineerPillar[] = [
  {
    num: "01",
    title: "Auditability Over Magic",
    summary: "Every AI decision must be grounded in traceable evidence.",
    detail: "If an operator can't inspect the chunk, page, and confidence behind an answer, it isn't production-ready.",
    microLabel: "AUDITABLE BY DESIGN",
  },
  {
    num: "02",
    title: "Defense-in-Depth Security",
    summary: "Never trust file extensions, MIME types, or unverified documents.",
    detail: "First 12 bytes checked on every upload. Retrieved chunks sanitized against indirect prompt injection.",
    microLabel: "HOSTILE-INPUT SAFE",
  },
  {
    num: "03",
    title: "Retrieval Quality Over Simplicity",
    summary: "Pure dense vector search is insufficient for enterprise data.",
    detail: "Exact policy numbers vanish in vector space. BM25 plus dense, fused by RRF, brings them back.",
    microLabel: "EXACT WHEN IT MATTERS",
  },
  {
    num: "04",
    title: "Structural Multi-Tenancy",
    summary: "Tenant isolation must be architectural, not a filtering afterthought.",
    detail: "Vector namespaces bound to org IDs. Caller identity verified on private queries. Secrets in isolated AWS vaults.",
    microLabel: "ISOLATED BY ARCHITECTURE",
  },
  {
    num: "05",
    title: "Graceful AI Escalation",
    summary: "AI should recognize its limits and hand off smoothly to humans.",
    detail: "No infinite loops. A priority queue matches users to agents atomically while an LLM writes a 4-bullet handoff.",
    microLabel: "HANDS OFF TO HUMANS",
  },
  {
    num: "06",
    title: "Engineering for Real Constraints",
    summary: "Production systems succeed on how they handle real-world edge cases.",
    detail: "Rate limits, circuit breakers, idempotency keys, session expiry, hash deduplication, stale-queue cleanup.",
    microLabel: "BUILT FOR 3 AM",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TECH STACK (grouped by category)
// ─────────────────────────────────────────────────────────────────────────────

export interface TechItem {
  name: string;
  detail: string;
}

export interface TechGroup {
  category: string;
  icon: string;
  items: TechItem[];
}

export const techStackGrouped: TechGroup[] = [
  {
    category: "AI & Retrieval",
    icon: "🤖",
    items: [
      { name: "GPT-4o / GPT-4o-mini", detail: "Support agent + document parsing (PDF/image)" },
      { name: "text-embedding-3-small", detail: "1536-dim dense vector embeddings" },
      { name: "BM25 (custom)", detail: "Lexical search engine, tenant-isolated, in-process" },
      { name: "@convex-dev/agent", detail: "Stateful AI agent with tool calling" },
      { name: "@convex-dev/rag", detail: "Vector storage + retrieval with namespace isolation" },
    ],
  },
  {
    category: "Backend & Data",
    icon: "⚡",
    items: [
      { name: "Convex", detail: "Real-time DB, serverless mutations/queries/actions" },
      { name: "AWS Secrets Manager", detail: "Per-tenant API keys at tenant/{orgId}/{service}" },
      { name: "Convex File Storage", detail: "Binary uploads stored + served via Convex Storage" },
    ],
  },
  {
    category: "Security",
    icon: "🛡️",
    items: [
      { name: "ModerationPipeline", detail: "Custom 6-stage AI safety pipeline (OWASP LLM02)" },
      { name: "uploadSecurity.ts", detail: "Magic byte + archive + formula injection defense" },
      { name: "Clerk JWT", detail: "Dashboard auth, org membership, JWT claims" },
    ],
  },
  {
    category: "Frontend",
    icon: "💻",
    items: [
      { name: "Next.js 15", detail: "Dashboard (Clerk-authenticated) + Widget (session-based)" },
      { name: "Vite (IIFE)", detail: "Embed script — zero npm runtime dependencies" },
      { name: "Jotai", detail: "Atomic state management in widget" },
      { name: "shadcn/ui + Tailwind", detail: "Component library across dashboard" },
    ],
  },
  {
    category: "Voice",
    icon: "🎙️",
    items: [
      { name: "Vapi AI", detail: "WebRTC voice sessions with real-time call management" },
      { name: "vapiWebhook.ts", detail: "Call lifecycle events → Convex conversation state" },
    ],
  },
  {
    category: "Tooling",
    icon: "🔧",
    items: [
      { name: "pnpm + Turborepo", detail: "Monorepo with workspace packages" },
      { name: "TypeScript strict", detail: "Strict mode across all packages" },
      { name: "Vitest", detail: "Security test suite — 6 suites, 100% passing" },
    ],
  },
];
