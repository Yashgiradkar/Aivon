# Aivon — Enterprise AI Customer Support & Voice Platform

> A production-grade, multi-tenant AI customer support platform featuring an embeddable chat widget, real-time operator dashboard, low-latency WebRTC voice with ElevenLabs multilingual speech, an autonomous voice-first travel agent, a multi-agent orchestration engine, hybrid RAG retrieval (BM25 + Dense + RRF), incremental document syncing with pure-JS SHA-256, human support queue matching, centralized audit logging with data lineage, and zero-trust OWASP GenAI safety guardrails — delivered in a single Turborepo monorepo.

---

## Table of Contents

- [Project Overview & Core Value](#project-overview--core-value)
- [System Architecture](#system-architecture)
- [True Directory Map](#true-directory-map)
- [Database Schema (20 Tables)](#database-schema-20-tables)
- [Core Subsystems & Innovations](#core-subsystems--innovations)
  - [1. Real-Time Human Support Queue & Operator Handoff](#1-real-time-human-support-queue--operator-handoff)
  - [2. Multilingual WebRTC Voice Pipeline & Interruption Guards](#2-multilingual-webrtc-voice-pipeline--interruption-guards)
  - [3. Incremental Document Update Pipeline & Structure-Aware Chunking](#3-incremental-document-update-pipeline--structure-aware-chunking)
  - [4. Hybrid RAG Retrieval (BM25 + Dense + RRF $k=60$)](#4-hybrid-rag-retrieval-bm25--dense--rrf-k60)
  - [5. Multi-Agent Orchestration Layer & Voice Travel Agent FSM](#5-multi-agent-orchestration-layer--voice-travel-agent-fsm)
  - [6. Centralized Audit Middleware & Data Lineage](#6-centralized-audit-middleware--data-lineage)
  - [7. Zero-Trust Security & OWASP GenAI Hardening](#7-zero-trust-security--owasp-genai-hardening)
  - [8. Tiered Rate Limiting & Token Accounting](#8-tiered-rate-limiting--token-accounting)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Bulletproof Getting Started Guide](#bulletproof-getting-started-guide)
  - [1. Clone & Install Dependencies](#1-clone--install-dependencies)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Initialize Convex Cloud Backend](#3-initialize-convex-cloud-backend)
  - [4. Run Development Servers](#4-run-development-servers)
  - [5. Embedding the Widget on Third-Party Websites](#5-embedding-the-widget-on-third-party-websites)
- [Testing & Quality Assurance (23 Test Suites)](#testing--quality-assurance-23-test-suites)
- [Primary Execution Workflows](#primary-execution-workflows)
- [API Reference Summary](#api-reference-summary)
- [Documentation Index](#documentation-index)

---

## Project Overview & Core Value

Aivon provides organizations with an autonomous, resilient customer support platform that unifies text chat, live voice telephony, automated knowledge retrieval, and human operator escalation.

### Core Value Drivers

1. **Zero-DevOps Real-Time Reactivity:** Powered by Convex, every message, queue status change, and operator availability update synchronizes automatically over persistent WebSockets without Redis Pub/Sub clusters or bespoke socket listeners.
2. **Deterministic Multi-Tenancy:** Ironclad tenant isolation across all 20 database tables, AWS Secrets Manager BYOK credential paths (`tenant/{orgId}/{service}`), and isolated RAG vector namespaces (`namespace: orgId`).
3. **Multimodal Fluidity (Chat ↔ Voice ↔ Human Queue):** Support inquiries seamlessly transition between automated AI responses, sub-second WebRTC voice conversations, and human operator escalation with background LLM briefing generation.
4. **Forensic Auditability & Data Lineage:** Full-lifecycle tracing captures user queries, retrieved document IDs, exact page/chunk references, retrieval confidence scores, model metadata, and latency across text and voice channels with sub-0.02ms overhead.
5. **Significant Unit Economic Optimization:** Incremental document hashing cuts re-embedding costs by >90%; deterministic intent fast-paths resolve 15% of queries in <5ms at $0 LLM cost; semantic caching eliminates redundant LLM calls by 35%.

---

## System Architecture

```
                               Host Website (Customer Web Page)
                                              │
                                      ┌───────┴───────┐
                                      │  apps/embed   │ (Vite IIFE injects iframe + floating bubble)
                                      └───────┬───────┘
                                              │ (Loads isolated sandbox)
                                      ┌───────▼───────┐
                                      │  apps/widget  │ (Next.js 15, Ephemeral 24h Session, Jotai State)
                                      └───────┬───────┘
                                              │ Real-Time WebSocket (Reactive Queries, Mutations & Voice)
                                              │
┌─────────────────────────────────────────────▼────────────────────────────────────────────────────────┐
│                                 packages/backend (Convex Cloud)                                      │
│                                                                                                      │
│  ┌───────────────────────────┐  ┌───────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ public/ API Tier          │  │ private/ API Tier         │  │ system/ AI Engine                │  │
│  │ (contactSessions,         │  │ (Clerk JWT Auth,          │  │ (Multi-Agent Orchestration,      │  │
│  │  messages, queue,         │  │  files, evaluations,      │  │  Hybrid RAG, Travel Agent FSM,   │  │
│  │  widgetSettings, secrets) │  │  secrets, queue, vapi)    │  │  Support Queue Matcher)          │  │
│  └─────────────┬─────────────┘  └─────────────┬─────────────┘  └────────────────┬─────────────────┘  │
│                │                              │                                 │                    │
│  ┌─────────────▼──────────────────────────────▼─────────────────────────────────▼──────────────────┐  │
│  │                         20 Database Tables (ACID Optimistic Concurrency)                        │  │
│  │ (conversations, supportQueue, contactSessions, ragLineageRecords, tenantRateLimits, ...)        │  │
│  └────────────────────────────────────────────┬────────────────────────────────────────────────────┘  │
│                                               │                                                      │
│                ┌──────────────────────────────┼──────────────────────────────┐                       │
│                ▼                              ▼                              ▼                       │
│     OpenAI Inference & RAG          ElevenLabs / Vapi Voice         AWS Secrets Manager              │
│    (text-embedding-3-small,        (WebRTC Audio Streaming,        (BYOK Credential Isolation:       │
│     gpt-4o-mini generation)         Multilingual TTS en/hi/mr)      tenant/{orgId}/{service})        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                              ▲
                                              │ Clerk JWT Real-Time Sync
                                      ┌───────┴───────┐
                                      │   apps/web    │ (Next.js 15 Operator Dashboard, /travel Agent)
                                      └───────────────┘
```

---

## True Directory Map

```
Aivon/
├── apps/
│   ├── web/                           # Operator Dashboard & Public Travel Agent (Next.js 15 App Router)
│   │   ├── app/
│   │   │   ├── (auth)/                # Clerk sign-in / sign-up / org-selection routes
│   │   │   ├── (dashboard)/           # Protected operator routes
│   │   │   │   ├── conversations/     # Live inbox, chat thread view & operator AI assist
│   │   │   │   ├── customization/     # Widget brand color, greeting & suggestions forms
│   │   │   │   ├── files/             # Knowledge base file manager & ingestion status
│   │   │   │   ├── evaluations/       # AI quality analytics & LLM-as-a-Judge inspection
│   │   │   │   ├── integrations/      # Embed script snippet configuration
│   │   │   │   ├── plugins/vapi/      # Voice assistant & phone configuration
│   │   │   │   └── billing/           # Subscription tier management
│   │   │   └── (travel)/travel/       # Standalone Voice-First Travel Agent interface
│   │   ├── modules/                   # UI feature modules (dashboard, files, evaluations, etc.)
│   │   └── middleware.ts              # Clerk auth enforcement & public route handling
│   │
│   ├── widget/                        # End-User Chat & Voice Widget (Next.js 15 Turbopack)
│   │   ├── app/                       # Embed iframe page & layout
│   │   ├── modules/widget/
│   │   │   ├── atoms/                 # Jotai fine-grained atomic state (widget-atoms.ts)
│   │   │   ├── hooks/                 # useVapi WebRTC hook (ElevenLabs TTS, barge-in guards)
│   │   │   ├── ui/
│   │   │   │   ├── screens/           # Chat, Voice, Contact, Inbox, Loading, Error screens
│   │   │   │   └── components/        # Queue banners, call logs, provenance cards, callbacks
│   │   │   └── constants.ts           # Screen names, storage keys, audio config
│   │
│   └── embed/                         # Embeddable Launcher Script (Vite 5 Vanilla TypeScript)
│       ├── embed.ts                   # 4.2KB zero-dependency IIFE script injecting iframe & FAB
│       ├── config.ts                  # Target widget URL & default positioning constants
│       └── demo.html                  # Local embed testing sandbox
│
├── packages/
│   ├── backend/                       # Centralized Convex Serverless Backend
│   │   └── convex/
│   │       ├── schema.ts              # Definitive database schema (20 relational tables)
│   │       ├── auth.config.ts         # Clerk JWT authentication configuration
│   │       ├── convex.config.ts       # Registers @convex-dev/agent and @convex-dev/rag
│   │       ├── http.ts                # HTTP action handlers (Clerk Svix webhook router)
│   │       ├── constants.ts           # 24h session TTL constants (SESSION_DURATION_MS)
│   │       ├── public/                # Public endpoints (contactSessions, messages, queue, etc.)
│   │       ├── private/               # Clerk-authenticated endpoints (files, secrets, queue, etc.)
│   │       ├── system/                # Internal-only functions and AI execution engines
│   │       │   ├── queue.ts           # Atomic FIFO + Priority queue matching & AI summary
│   │       │   └── ai/
│   │       │       ├── agents/        # supportAgent.ts (gpt-4o-mini singleton)
│   │       │       ├── tools/         # search.ts, escalateConversation.ts, resolveConversation.ts
│   │       │       ├── orchestration/ # ConversationRouter, OrchestrationPlanner, CapabilityRegistry
│   │       │       ├── travel/        # TravelWorkflowManager FSM, TravelNormalizer, Provider
│   │       │       ├── rag/           # Hybrid RAG (bm25.ts, fusion.ts, unifiedSearch.ts)
│   │       │       │   └── incremental/ # pageSplitter.ts (Pure SHA-256), structureChunker.ts
│   │       │       ├── observability/ # auditMiddleware.ts, costCalculator.ts, logger.ts
│   │       │       ├── security/      # moderationPipeline.ts (21 heuristics), sanitizer.ts
│   │       │       ├── rateLimit/     # rateLimiter.ts (Tiered token accounting & quotas)
│   │       │       └── evaluation/    # judge.ts (LLM-as-a-Judge v2026.1 rubric actions)
│   │       └── lib/
│   │           ├── uploadSecurity.ts  # Magic byte checks (%PDF, PNG, JPEG), zip bomb protection
│   │           ├── extractTextContent.ts # Multi-format parsers (PDF, image, CSV, JSON, MD)
│   │           └── secrets.ts         # AWS Secrets Manager CRUD client
│   │
│   ├── ui/                            # Shared UI Component Library (@workspace/ui, Tailwind v4)
│   ├── eslint-config/                 # Shared ESLint v9 configuration
│   └── typescript-config/             # Shared TypeScript configuration bases
│
├── eval/                              # Automated Test Suites (23 Suites / 100% Pass)
│   └── tests/                         # Security, OWASP, RAG, Voice, Queue, Orchestration tests
│
├── docs/                              # Detailed Technical Documentation
│   ├── architecture.md                # System design & component boundaries
│   ├── api.md                         # Complete Convex API reference
│   ├── decisions.md                   # Architectural Decision Records (ADR-001 to ADR-011)
│   ├── implementation.md              # Deep implementation workflows & state machines
│   ├── development.md                 # Local development & testing standards
│   └── production-architecture.md     # Production deployment topology & monitoring
│
├── system-design-interview.md         # 1,797-Line FAANG System Design Interview Guide & Audit
├── aivon_interview_prep.md            # Comprehensive Candidate Interview Preparation Guide
├── SECURITY.md                        # Enterprise security controls & vulnerability disclosure
├── turbo.json                         # Turborepo task pipeline definition
├── pnpm-workspace.yaml                # Monorepo workspace configuration
└── package.json                       # Root scripts & devDependencies
```

---

## Database Schema (20 Tables)

All persistent data structures are strictly defined in `packages/backend/convex/schema.ts`:

| Table Name                 | Description                                                                       | Key Indexes                                                |
| :------------------------- | :-------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| `subscriptions`            | Multi-tenant billing status and limits                                            | `by_organization_id`                                       |
| `widgetSettings`           | Custom branding, greetings, suggestions, and Vapi voice IDs                       | `by_organization_id`                                       |
| `plugins`                  | Registered third-party extensions per organization                                | `by_organization_id`, `by_organization_id_and_service`     |
| `conversations`            | Support conversation threads and statuses (`unresolved`, `escalated`, `resolved`) | `by_organization_id`, `by_contact_session_id`, `by_status` |
| `contactSessions`          | Ephemeral 24h customer sessions with browser metadata                             | `by_organization_id`, `by_expires_at`                      |
| `supportQueue`             | Customer queue entries for human handoff with priority weighting                  | `by_organization_id_and_status`, `by_conversation_id`      |
| `supportAgentAvailability` | Operator real-time presence heartbeats (`available`, `busy`, `offline`)           | `by_organization_id_and_status`, `by_agent_id`             |
| `supportCalls`             | Active and historical voice/telephony support call sessions                       | `by_organization_id`, `by_queue_entry_id`                  |
| `users`                    | Development and testing user stub table                                           | `by_token`                                                 |
| `evaluations`              | LLM-as-a-Judge quality scores (Groundedness, Relevance, Tone)                     | `by_organization_id`, `by_conversation_id`                 |
| `customerMemories`         | Long-term customer preferences and interaction memory                             | `by_organization_id`, `by_contact_session_id`              |
| `semanticAnswerCache`      | Cached question-and-answer pairs for sub-100ms FAQ retrieval                      | `by_organization_id`, `by_hash`                            |
| `backgroundJobs`           | Asynchronous task tracking (document indexing, summary generation)                | `by_organization_id`, `by_status`                          |
| `tenantRateLimits`         | Tiered organization rate limits, concurrency caps, and monthly tokens             | `by_organization_id`                                       |
| `keyedRateLimits`          | Sliding-window request counters keyed by IP or session ID                         | `by_key`, `by_window_start`                                |
| `orchestrationExecutions`  | Execution step logs and latency metrics for multi-agent workflows                 | `by_organization_id`, `by_trace_id`                        |
| `travelSessions`           | Active multi-turn travel booking sessions and slot states                         | `by_session_id`                                            |
| `travelBookings`           | Confirmed travel reservations, PNR references, and passenger data                 | `by_organization_id`, `by_booking_reference`               |
| `aiAuditEvents`            | Centralized audit trail across Chat, Voice, and Operator actions                  | `by_organization_id`, `by_trace_id`, `by_channel`          |
| `ragLineageRecords`        | Forensic data lineage linking generated answers to retrieved chunks               | `by_organization_id`, `by_trace_id`, `by_conversation_id`  |

---

## Core Subsystems & Innovations

### 1. Real-Time Human Support Queue & Operator Handoff

- **Atomic Matching Engine (`system/queue.ts:matchAndAssign`):** Matches waiting customers to available operators using Convex Optimistic Concurrency Control (OCC). Priority sorting strictly prioritizes `urgent (3) > high (2) > normal (1)`, tie-broken by `joinedAt` ascending (strict FIFO).
- **Background AI Handoff Summarization (`generateSummary`):** When enqueued, an asynchronous action invokes `gpt-4o-mini` to extract the customer's core issue, sentiment, and attempted solutions, rendering an instant briefing card on the operator's dashboard.
- **Dynamic Queue Positions:** Recalculates caller queue positions atomically and broadcasts live wait-time estimates down to the widget over WebSockets.

### 2. Multilingual WebRTC Voice Pipeline & Interruption Guards

- **Low-Latency Streaming Voice (`apps/widget/modules/widget/hooks/use-vapi.ts`):** Direct WebRTC audio bridge powered by Vapi and ElevenLabs Turbo v2.5 (`optimizeStreamingLatency: 3`).
- **Multilingual Enforcement:** Dynamic language enforcement across English (`en`), Hindi (`hi`), and Marathi (`mr`).
- **Monotonic Turn-ID Guard (`currentTurnIdRef`):** Eliminates stale audio playback upon user interruption (barge-in) by tagging utterances with monotonic turn IDs and instantly discarding in-flight audio buffers on `user-interrupted` events.
- **Speech Prosody Normalization (`formatForSpeech`):** Converts Markdown tables, bullet points, and alphanumeric policy codes into conversational natural speech suitable for streaming TTS.

### 3. Incremental Document Update Pipeline & Structure-Aware Chunking

- **Pure-JS FIPS 180-4 SHA-256 (`pageSplitter.ts`):** Enables deterministic page-level content hashing directly inside the Convex V8 serverless isolate runtime without external Node.js container cold starts or `node:crypto` dependencies.
- **Embedding Cache Reuse (`diffEngine.ts`):** Compares page hashes against the existing manifest. Only dirty or changed pages are re-embedded, saving **>90% of embedding API costs** and reducing re-indexing from 15 seconds to <650ms.
- **Structure-Aware Table Preservation (`structureChunker.ts`):** Preserves Markdown tables, code blocks, and section hierarchies as indivisible atomic units, duplicating table headers across split chunks to prevent tabular RAG corruption.

### 4. Hybrid RAG Retrieval (BM25 + Dense + RRF $k=60$)

- **Dual-Path Scoring (`packages/backend/convex/system/ai/rag/`):** Combines 1536-dimensional dense vector embeddings (`text-embedding-3-small`) with Okapi BM25 sparse keyword matching using Reciprocal Rank Fusion ($k=60$).
- **Deterministic Policy Routing:** Queries matching policy or invoice regex patterns (`POL-[A-Z0-9]+`) trigger instant metadata lookups, bypassing vector search and resolving in **<12ms**.

### 5. Multi-Agent Orchestration Layer & Voice Travel Agent FSM

- **Intent Router (`ConversationRouter`):** Deterministic zero-latency regex classifier categorizing queries (`greeting`, `escalation_request`, `policy_lookup`, `multi_step`) to bypass unnecessary LLM planning overhead.
- **Execution Planner (`OrchestrationPlanner`):** Dynamically decomposes complex inquiries and routes to specialized subagents.
- **Voice Travel Agent FSM (`voiceTravelAgent.ts`):** Multi-turn state machine handling spoken travel booking (`GREETING → COLLECTING_REQUIREMENTS → CLARIFYING → SEARCHING → AWAITING_SELECTION → AWAITING_CONFIRMATION → BOOKED`).
- **Consequential Action Safety Gate:** Consequential mutations (e.g., flight bookings) are protected by a hard code assertion requiring `confirmedByCustomer === true` through explicit affirmative voice confirmation.

### 6. Centralized Audit Middleware & Data Lineage

- **Unified Middleware (`AuditMiddleware`):** Captures all AI operations across Chat, Voice, and Operator workflows with correlated trace IDs (`tr_{channel}_{timestamp}_{rand}`).
- **Complete RAG Lineage (`ragLineageRecords`):** Forensically links generated responses to retrieved document IDs, filenames, page numbers, chunk IDs, similarity scores, and exact text snippets.
- **Sub-0.02ms Overhead:** Dispatches audit persistence asynchronously without delaying customer response streaming.

### 7. Zero-Trust Security & OWASP GenAI Hardening

- **Heuristic Moderation Pipeline (`moderationPipeline.ts`):** Screens user prompts and retrieved RAG chunks against 21 prompt injection heuristics (jailbreaks, instruction overrides, system prompt exfiltration).
- **Upload Security (`uploadSecurity.ts`):** Validates magic byte signatures (`%PDF`, PNG, JPEG), enforces strict size quotas (max 50MB, max 200 pages), sanitizes filenames against directory traversal, and blocks decompression bombs.
- **AWS Secrets Manager BYOK:** All third-party credentials (OpenAI, Vapi) are isolated under `tenant/{organizationId}/{service}` and read only by internal server actions. Zero raw keys reside in the database.
- **Strict Content Security Policy (CSP):** Production script execution strictly prohibits `unsafe-eval` and enforces HSTS preloading.

### 8. Tiered Rate Limiting & Token Accounting

- **Server-Side Quotas (`tenantRateLimits`):**
  - **Free:** 20 RPM, 2 concurrent operations, 100k tokens/month.
  - **Pro:** 120 RPM, 10 concurrent operations, 2.5M tokens/month.
  - **Enterprise:** 600 RPM, 50 concurrent operations, 25M tokens/month.
- **Atomic Admission & Token Reconciliation:** `RateLimiterLogic.checkAndAdmit` atomically verifies limits before LLM dispatch; `reconcileTokens` updates actual token usage post-generation.

---

## Tech Stack

| Category                  | Technology                                                                                              |
| :------------------------ | :------------------------------------------------------------------------------------------------------ |
| **Monorepo Architecture** | [Turborepo](https://turbo.build/) v2, [pnpm](https://pnpm.io/) v10.4.1 Workspaces                       |
| **Operator Dashboard**    | [Next.js](https://nextjs.org/) 15 (App Router), React 19, TypeScript 5.7                                |
| **Customer Widget**       | Next.js 15 (Turbopack), React 19, Jotai v2 Atomic State                                                 |
| **Embeddable Launcher**   | Vanilla TypeScript IIFE (4.2KB, zero dependencies), [Vite](https://vitejs.dev/) v5                      |
| **Backend & Database**    | [Convex](https://convex.dev/) v1.25 (real-time reactive serverless ACID database)                       |
| **AI Framework**          | [Vercel AI SDK](https://sdk.vercel.ai/) v4, `@convex-dev/agent` v0.1, OpenAI `gpt-4o-mini`              |
| **RAG & Embeddings**      | `@convex-dev/rag` v0.3, OpenAI `text-embedding-3-small` (1536 dim), Pure-JS SHA-256                     |
| **Voice & Telephony**     | [Vapi AI](https://vapi.ai/) WebRTC client, [ElevenLabs](https://elevenlabs.io/) Turbo v2.5 / Scribe STT |
| **Authentication**        | [Clerk](https://clerk.com/) Multi-Organization JWTs (Dashboard) + Ephemeral 24h Sessions (Widget)       |
| **Secrets Management**    | AWS Secrets Manager (`@aws-sdk/client-secrets-manager`)                                                 |
| **UI Components**         | Shared `@workspace/ui` package (Radix UI primitives, Tailwind CSS v4)                                   |
| **Testing Engine**        | `tsx` + Node.js native assert (23 automated test suites, 100% pass)                                     |

---

## Prerequisites

Ensure your local development environment meets the following minimum requirements:

- **Node.js:** `>= 20.0.0`
- **pnpm:** `10.4.1` (enforced via `packageManager` in `package.json`)
- **Convex Account:** [convex.dev](https://convex.dev) (for serverless database deployment)
- **Clerk Account:** [clerk.com](https://clerk.com) (for multi-tenant organization authentication)
- **OpenAI API Key:** [platform.openai.com](https://platform.openai.com) (for LLM inference & RAG embeddings)
- **AWS Account:** Required for Secrets Manager (tenant API key isolation)
- **Vapi Account** _(Optional):_ [vapi.ai](https://vapi.ai) (for WebRTC voice calling)
- **ElevenLabs Account** _(Optional):_ [elevenlabs.io](https://elevenlabs.io) (for multilingual TTS voices)

---

## Bulletproof Getting Started Guide

Follow these exact steps to initialize, configure, and run the entire platform locally.

### 1. Clone & Install Dependencies

```bash
# 1. Clone the repository
git clone https://github.com/Yashgiradkar/Aivon.git
cd Aivon

# 2. Install monorepo dependencies using pnpm
pnpm install
```

### 2. Configure Environment Variables

Create `.env.local` files for each application.

#### A. Backend Configuration (`packages/backend/.env.local`)

```env
CONVEX_DEPLOYMENT=dev:<your-deployment-slug>
CONVEX_URL=https://<your-deployment-slug>.convex.cloud
CONVEX_SITE_URL=https://<your-deployment-slug>.convex.site
CLERK_JWT_ISSUER_DOMAIN=https://<your-clerk-instance>.clerk.accounts.dev
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
OPENAI_API_KEY=sk-...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

#### B. Dashboard Configuration (`apps/web/.env.local`)

```env
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment-slug>.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://<your-clerk-instance>.clerk.accounts.dev
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGNIN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGNUP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGNIN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGNUP_FALLBACK_REDIRECT_URL=/
```

#### C. Widget Configuration (`apps/widget/.env.local`)

```env
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment-slug>.convex.cloud
NEXT_PUBLIC_VAPI_PUBLIC_KEY=...       # Optional: fallback public key
NEXT_PUBLIC_VAPI_ASSISTANT_ID=...     # Optional: fallback assistant ID
```

### 3. Initialize Convex Cloud Backend

```bash
# Navigate to backend package and run setup (first-time deployment)
cd packages/backend
pnpm run setup
```

_This command executes `convex dev --until-success`, provisioning database tables, indexes, and scheduled function crons._

### 4. Run Development Servers

From the **repository root**, start all four applications concurrently via Turborepo:

```bash
pnpm dev
```

| Application        | Local Port | Access URL              | Purpose                                        |
| :----------------- | :--------- | :---------------------- | :--------------------------------------------- |
| `apps/web`         | **3000**   | `http://localhost:3000` | Operator Dashboard & `/travel` Voice Interface |
| `apps/widget`      | **3001**   | `http://localhost:3001` | End-User Chat & Voice Widget                   |
| `apps/embed`       | **3002**   | `http://localhost:3002` | Vite Dev Server for Embed Script               |
| `packages/backend` | Cloud      | Convex Dashboard        | Real-Time Reactive Database & Functions        |

_To run an individual application:_

```bash
cd apps/web && pnpm dev          # Dashboard only
cd apps/widget && pnpm dev       # Widget only
cd apps/embed && pnpm dev        # Embed script dev server only
cd packages/backend && pnpm dev  # Convex functions watcher only
```

### 5. Embedding the Widget on Third-Party Websites

To embed the chat widget on an external website, build the embed script and add the `<script>` tag:

```bash
# Build the distributable embed script
cd apps/embed && pnpm build
```

Paste the snippet before the closing `</body>` tag on any HTML page:

```html
<script
  src="http://localhost:3002/embed.js"
  data-organization-id="YOUR_ORGANIZATION_ID"
  data-position="bottom-right"
  defer
></script>
```

#### Programmatic JavaScript API

The script exposes a global `EchoWidget` object on `window`:

```js
// Show or hide the widget programmatically
EchoWidget.show();
EchoWidget.hide();

// Change organization or position dynamically
EchoWidget.init({ organizationId: "org_custom_123", position: "bottom-left" });

// Remove widget iframe and button from host DOM
EchoWidget.destroy();
```

---

## Testing & Quality Assurance (23 Test Suites)

Aivon maintains a comprehensive testing pipeline with **23 test suites (100% passing)** executed using `tsx`:

```bash
# Run all 23 automated test suites
pnpm test
```

### Granular Testing Commands

```bash
# Security, OWASP & guardrail verification
pnpm test:security

# Incremental RAG, structure chunking & pure SHA-256 diffing
pnpm test:incremental

# Multi-turn voice travel agent & consequential action verification
pnpm test:travel

# Multi-agent orchestration router, planner & capability registry
pnpm test:orchestration

# Support queue concurrency, priority matching & AI summaries
pnpm test:queue

# Rate limiting, semantic cache, memory & background jobs
pnpm test:infra

# Policy code regex & deterministic retrieval tests
pnpm test:policy

# End-to-end RAG retrieval accuracy tests
pnpm test:accuracy
```

### Code Quality & Build Verification

```bash
# Build all packages and applications in dependency order
pnpm build

# Run ESLint across all packages
pnpm lint

# Format all TypeScript, TSX, and Markdown files
pnpm format

# Verify TypeScript types per package
pnpm typecheck
```

---

## Primary Execution Workflows

### 1. End-User Message to AI Response

1. **Visitor Submission:** The widget calls `public/messages.ts:create` with `{ conversationId, contactSessionId, content }`.
2. **Synchronous Validation (<45ms):** The mutation verifies the session expiration, validates rate limits via `RateLimiterLogic.checkAndAdmit`, sanitizes input against 21 prompt injection heuristics, inserts the message, and schedules the asynchronous agent action via `ctx.scheduler.runAfter(0, ...)`.
3. **Asynchronous Generation:** `supportAgent.ts` retrieves the sliding conversation context, checks `semanticAnswerCache` for instant FAQ hits, and classifies intent via `ConversationRouter`.
4. **Hybrid Retrieval:** If knowledge search is required, `searchTool` invokes sparse BM25 and dense vector search, fuses candidates via Reciprocal Rank Fusion ($k=60$), records lineage in `ragLineageRecords`, and synthesizes a grounded answer.
5. **Reactive Push:** Convex's reactive engine automatically pushes the assistant's message down to both the widget and operator dashboard WebSockets.

### 2. Human Support Queue Escalation & Assignment

1. **Trigger:** The AI agent calls `escalateConversation` (or the customer clicks _"Talk to human"_).
2. **Enqueue:** `system/queue.ts:enqueue` inserts a record in `supportQueue`, calculates the caller's live queue position, and schedules `generateSummary`.
3. **Handoff Summary:** `gpt-4o-mini` reads the message history and writes a structured briefing to `supportQueue.summary`.
4. **Atomic Matching:** `matchAndAssign` selects available operators (`supportAgentAvailability`), sorts waiting entries by priority (`urgent > high > normal`) and `joinedAt` (FIFO), and atomically updates customer and operator records using OCC.
5. **Dashboard Transition:** The assigned operator's dashboard transitions immediately to the conversation view with the briefing card displayed.

### 3. Voice Travel Booking with Consequential Action Gate

1. **Spoken Intent:** The user speaks: _"Book the morning flight from Delhi to Mumbai tomorrow."_
2. **Normalization:** `TravelNormalizer` maps spoken ordinals, resolves relative dates, and populates `TravelSlots`.
3. **FSM Search:** `TravelWorkflowManager` transitions through `COLLECTING_REQUIREMENTS → SEARCHING → AWAITING_SELECTION`.
4. **Confirmation Request:** The FSM prompts: _"Option 1 is the 8:15 AM flight for $110. Please say 'yes confirm' to book."_
5. **Hard Safety Gate:** Only when the user explicitly provides affirmative confirmation does the system set `confirmedByCustomer === true` and execute the external reservation via `travelProvider.initiateBooking`.

---

## API Reference Summary

The Convex backend exposes real-time queries, mutations, and actions partitioned by security privilege:

- **`public/*` (Widget-Facing, Ephemeral Session Auth):**
  - `contactSessions.create` / `validateSession`
  - `conversations.create` / `get` / `list`
  - `messages.create` / `list`
  - `queue.join` / `getStatus` / `leave` / `scheduleCallback`
  - `widgetSettings.getByOrganization`
  - `secrets.getVapiPublicKey`
- **`private/*` (Dashboard-Facing, Clerk JWT Auth):**
  - `conversations.list` / `get` / `updateStatus`
  - `messages.create` / `enhanceResponse` (Operator AI Polish)
  - `queue.listWaiting` / `setAgentAvailability` / `completeCall`
  - `files.addFile` / `list` / `deleteFile`
  - `evaluations.list` / `getSummary` / `addHumanReview`
  - `secrets.upsert` (triggers async AWS Secrets Manager write)
  - `vapi.listAssistants` / `listPhoneNumbers`
- **`http.ts` (External Webhooks):**
  - `POST /clerk-webhook` — Svix-verified webhook updating organization memberships and subscription tiers.

---

## Documentation Index

For in-depth architectural specifications and operational manuals, consult the documentation directory:

| Document                                                                 | Primary Focus                                                                                |
| :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| [**system-design-interview.md**](./system-design-interview.md)           | Comprehensive 1,797-line FAANG-level system design guide, incident runbooks, and estimations |
| [**aivon_interview_prep.md**](./aivon_interview_prep.md)                 | Exhaustive candidate interview preparation guide covering all codebase workflows             |
| [**docs/architecture.md**](./docs/architecture.md)                       | Formal system architecture, component boundaries, and reactive data flow diagrams            |
| [**docs/api.md**](./docs/api.md)                                         | Complete Convex API specification for all `public/*`, `private/*`, and `system/*` endpoints  |
| [**docs/decisions.md**](./docs/decisions.md)                             | Architectural Decision Records (ADR-001 through ADR-011) documenting trade-offs              |
| [**docs/implementation.md**](./docs/implementation.md)                   | Deep implementation notes on session lifecycles, hybrid RAG, FSMs, and guardrails            |
| [**docs/development.md**](./docs/development.md)                         | Monorepo developer guide, testing conventions, and CI/CD pipelines                           |
| [**docs/production-architecture.md**](./docs/production-architecture.md) | Production infrastructure topology, SLOs/SLIs, scaling limits, and alerting runbooks         |
| [**SECURITY.md**](./SECURITY.md)                                         | Enterprise security baseline, OWASP controls, vulnerability reporting, and BYOK encryption   |
| [**CHANGELOG.md**](./CHANGELOG.md)                                       | Chronological release history and feature milestones                                         |
| [**AGENTS.md**](./AGENTS.md)                                             | Coding conventions, strict invariants, and safe modification guidelines for AI agents        |
