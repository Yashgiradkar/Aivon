# Aivon AI Customer Support — Production Architecture Specification

## 1. System Overview & Monorepo Structure

Aivon is a production-grade, multi-tenant AI customer support platform delivering real-time intelligent chat support, human-agent escalation with atomic queue matching, hybrid RAG knowledge retrieval, multi-agent orchestration, voice-first travel booking, and an LLM evaluation pipeline.

### Workspace Architecture
- **`apps/web`** (Port 3000): Operator & Management Dashboard (Next.js 15 App Router, Clerk Authentication, Tailwind CSS / Shadcn UI). Also hosts `/travel` — the public, voice-first AI travel agent page.
- **`apps/widget`** (Port 3001): End-User Chatbot Widget embedded via iframe (Next.js 15, Session-based Anonymous Auth, Jotai state management).
- **`apps/embed`** (Port 3002): Lightweight zero-dependency JS loader (Vite build) injected into customer websites.
- **`packages/backend`**: Convex serverless backend providing real-time reactive database, serverless actions/mutations/queries, file storage, integrated AI Agents, hybrid RAG vector search, multi-agent orchestration, and AI safety guardrails.
- **`packages/ui`**: Shared UI component library.
- **`eval/`**: Standalone test suites (`tsx`-executed) for normalizer, workflow, RAG, and security guardrail validation.

---

## 2. Request & Execution Flows

### 2.1 End-User Chat & AI Support Flow
```
Customer Widget (iframe)
  │
  ├── 1. contactSessions.create() ──► Validates org, issues 24h session token
  ├── 2. conversations.create()   ──► Creates threadId in supportAgent
  └── 3. public/messages.create()  ──► Convex Action
        │
        ├── InputSanitizer      ──► Strip control chars, PII redaction, injection detection
        ├── RateLimiter         ──► Sliding-window check per contactSessionId
        ├── Session & Subscription Verification
        │
        ├── ConversationRouter  ──► Deterministic intent classification (no LLM cost)
        │     ├── "support_inquiry"    ──► OrchestrationPlanner → SupportAgentCapability
        │     ├── "travel_inquiry"     ──► OrchestrationPlanner → TravelAgentCapability
        │     └── "escalation_request" ──► OrchestrationPlanner → EscalationCapability
        │
        ├── [support_inquiry path]
        │   └── supportAgent.generateText() [OpenAI / @convex-dev/agent]
        │         ├── searchTool ──► Hybrid RAG (BM25 + Dense + RRF, namespace: orgId)
        │         ├── escalateConversationTool ──► Atomic supportQueue FIFO enqueue
        │         └── resolveConversationTool  ──► Mark conversation resolved
        │
        ├── [travel_inquiry path]  (also available at /travel standalone page)
        │   └── TravelWorkflowManager.processTurn()
        │         ├── TravelNormalizer    ──► Slot extraction, location/date/mode resolution
        │         ├── DeterministicMockTravelProvider.search()
        │         └── DeterministicMockTravelProvider.initiateBooking() [confirmation-gated]
        │
        └── OutputGuardrails    ──► Schema validation, system-prompt leakage check
```

### 2.2 Human Escalation & Queue Matching Flow
```
Escalation Trigger (AI escalateConversationTool OR Customer button)
  │
  ├── 1. supportQueue.enqueue() (FIFO + Priority weight)
  ├── 2. supportAgentAvailability (Available agents in organization)
  ├── 3. matchAndAssign() (Atomic reservation of customer & agent)
  ├── 4. generateSummary() (AI handoff summary from conversation transcript)
  └── 5. Operator Dashboard Real-time Notification (Convex live subscription)
```

### 2.3 Hybrid RAG Retrieval Flow
```
User Query
  │
  ├── QueryRouter.classify() ──► "bm25" | "hybrid" | "dense"
  │     Criteria: exact codes, quoted strings → bm25
  │              mixed technical + semantic   → hybrid
  │              natural language             → dense / hybrid
  │
  ├── [bm25]  TenantBM25Cache.search() ──► Okapi BM25 (k₁=1.2, b=0.75)
  ├── [dense] rag.search(namespace=orgId) ──► text-embedding-3-small (1536d)
  │
  ├── [hybrid] Promise.allSettled([bm25, dense])
  │     └── RRF.fuse(bm25Results, denseResults, k=60)
  │
  ├── Evidence thresholding + citation assembly
  └── SEARCH_INTERPRETER_PROMPT + gpt-4o-mini ──► Conversational response

  Degraded mode: if OpenAI embedding API fails → falls back to pure BM25
```

### 2.4 Voice-First Travel Agent Flow (Standalone)
```
User at /travel (no auth required)
  │
  ├── Web Speech API: SpeechRecognition.start()
  ├── Spoken transcript ──► public/travel.processTurn()
  │     ├── TravelNormalizer.extractAndMergeSlots()
  │     └── TravelWorkflowManager.processTurn(currentState, slots, text)
  │           GREETING → COLLECTING_REQUIREMENTS → CLARIFYING
  │               → SEARCHING → AWAITING_SELECTION
  │               → AWAITING_CONFIRMATION → BOOKED
  │
  ├── [AWAITING_CONFIRMATION + "yes confirm"]
  │     └── DeterministicMockTravelProvider.initiateBooking()
  │           ├── confirmedByCustomer === true STRICTLY REQUIRED
  │           ├── Idempotency check (idempotencyKey)
  │           └── Returns bookingReference (PNR-*)
  │
  └── speechSynthesis.speak(spokenResponse) ──► Audio output to user
```

---

## 3. Security, Boundaries & Tenant Isolation

1. **Tenant Isolation**:
   - Every database query strictly filters by `organizationId`.
   - Every RAG vector search/index operation specifies `namespace: orgId`.
   - BM25 corpus cache is partitioned by `organizationId` — never shared across tenants.
   - AWS Secrets Manager keys are strictly namespaced (`tenant/{organizationId}/{service}`).
   - Travel sessions are keyed by random token, not orgId — no cross-tenant access possible.

2. **Authentication Boundary**:
   - `public/*`: Widget endpoints guarded by `contactSessionId` validation with expiry checks.
   - `private/*`: Operator endpoints guarded by Clerk JWT authentication (`ctx.auth.getUserIdentity()`).
   - `system/*`: Internal-only serverless functions inaccessible from client RPCs.
   - `/travel`: Public route in `middleware.ts` — no Clerk auth required (stateless voice UI).

3. **AI Input/Output Security Layer** (applied in `public/messages.ts` on every request):
   - **InputSanitizer** (`system/ai/security/sanitizer.ts`): Control character stripping, wraps in `<untrusted_user_input>` boundary, PII redaction (`[REDACTED_CC]`, `[REDACTED_SSN]`), prompt injection heuristic detection.
   - **RateLimiter** (`system/ai/security/rateLimiter.ts`): Sliding-window rate limit per `contactSessionId` — prevents message flooding.
   - **OutputGuardrails** (`system/ai/security/guardrails.ts`): Output schema validation, system-prompt leakage detection.

4. **Consequential Action Guardrails** (travel agent):
   - `DeterministicMockTravelProvider.initiateBooking()` strictly rejects if `confirmedByCustomer !== true`.
   - Idempotency keys prevent duplicate reservations even under network retries.
   - No booking state exists until user explicitly utters a confirmation phrase.

---

## 4. Database Tables (production-relevant)

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `contactSessions` | Anonymous widget sessions (24h TTL) | `by_organization_id`, `by_expires_at` |
| `conversations` | Chat threads between users and AI/operators | `by_organization_id`, `by_status_and_organization_id`, `by_thread_id` |
| `subscriptions` | Per-org subscription status (gates AI features) | `by_organization_id` |
| `widgetSettings` | Org widget config, Vapi settings | `by_organization_id` |
| `plugins` | Third-party plugin registrations (Vapi) | `by_organization_id_and_service` |
| `supportQueue` | FIFO + priority queue for human escalation | `by_organization_id_and_status` |
| `supportAgentAvailability` | Real-time operator presence | `by_organization_id_and_status` |
| `supportCalls` | Vapi voice call records | `by_conversation_id` |
| `travelSessions` | Voice travel agent session state | `by_session_token` |
| `travelBookings` | Confirmed travel bookings with idempotency | `by_idempotency_token`, `by_booking_reference` |

---

## 5. Production Baseline Checklist

| Domain | Status | Key Characteristics |
|---|---|---|
| **Security** | ✅ Implemented | `InputSanitizer` (PII redaction, injection detection), `RateLimiter` (sliding-window), `OutputGuardrails` (schema validation) |
| **Reliability** | ✅ Implemented | Model registry, exponential backoff + jitter, timeouts, `CircuitBreaker` (CLOSED/OPEN/HALF_OPEN) |
| **LLM & Tokens** | ✅ Implemented | Centralized model config, strict `maxTokens` budgets, sliding context window |
| **RAG Pipeline** | ✅ Implemented | Hybrid BM25 + dense + RRF, deterministic query routing, degraded-mode fallback, tenant isolation |
| **Agents & Tools** | ✅ Implemented | `supportAgent` + `TravelAgentCapability`; orchestration router + planner; structured tool schemas |
| **Voice Travel Agent** | ✅ Implemented | Multi-turn state machine, slot normalizer, consequential action gates, idempotency, 100% test pass |
| **HITL** | ✅ Implemented | FIFO+priority queue, atomic agent matcher, AI handoff summaries, Vapi WebRTC bridge |
| **Evaluation** | ✅ Implemented | LLM-as-a-Judge (v2026.1 rubric), human review workflow, per-org analytics dashboard |
| **Observability** | ✅ Implemented | Sentry integration (web), Convex function logs, structured error codes |
| **Testing** | ✅ Implemented | `travelNormalizer.test.ts` (7 suites), `travelWorkflow.test.ts` (4 suites), security guardrail tests |
| **Cost Controls** | ✅ Implemented | BM25 as zero-API-cost fallback, subscription gates, rate limiting per session |
| **Performance** | ✅ Optimized | Zero N+1 queries, streaming responses, suspense boundaries, layout-level prefetching |
