# Aivon AI Customer Support — Production Architecture Specification

## 1. System Overview & Monorepo Structure

Aivon is an enterprise multi-tenant AI-powered customer support platform that provides real-time intelligent chatbot support, agent escalation with atomic queue matching, and knowledge retrieval.

### Workspace Architecture
- **`apps/web`** (Port 3000): Operator & Management Dashboard (Next.js 15 App Router, Clerk Authentication, Tailwind CSS / Shadcn UI).
- **`apps/widget`** (Port 3001): End-User Chatbot Widget embedded via iframe (Next.js 15, Session-based Anonymous Auth, Jotai state management).
- **`apps/embed`** (Port 3002): Lightweight zero-dependency JS loader (Vite build) injected into customer websites.
- **`packages/backend`**: Convex serverless backend providing real-time reactive database, serverless actions/mutations/queries, file storage, and integrated AI Agents & RAG vector search.
- **`packages/ui`**: Shared UI component library.

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
        ├── Session & Org Verification
        ├── Rate Limit & Token Limit Checks
        ├── Security & Injection Guardrail Filter
        ├── supportAgent.generateText() [OpenAI / @convex-dev/agent]
        │     ├── searchTool ──────────► RAG Vector Search (namespace: orgId)
        │     ├── escalateConversationTool ──► Atomic supportQueue FIFO enqueue
        │     └── resolveConversationTool  ──► Mark conversation resolved
        └── Denormalized Conversation Update (lastMessageText, lastMessageRole, lastMessageAt)
```

### 2.2 Human Escalation & Queue Matching Flow
```
Escalation Trigger (AI tool or Customer button)
  │
  ├── 1. supportQueue.enqueue() (FIFO + Priority weight)
  ├── 2. supportAgentAvailability (Available agents in organization)
  ├── 3. matchAndAssign() (Atomic reservation of customer & agent)
  ├── 4. generateSummary() (AI handoff summary from conversation transcript)
  └── 5. Operator Dashboard Real-time Notification (Convex live subscription)
```

---

## 3. Security, Boundaries & Tenant Isolation

1. **Tenant Isolation**:
   - Every database query strictly filters by `organizationId`.
   - Every RAG vector search/index operation specifies `namespace: orgId`.
   - AWS Secrets Manager keys are strictly namespaced (`tenant/{organizationId}/{service}`).

2. **Authentication Boundary**:
   - `public/*`: Widget endpoints guarded by `contactSessionId` validation with expiry checks.
   - `private/*`: Operator endpoints guarded by Clerk JWT authentication (`ctx.auth.getUserIdentity()`).
   - `system/*`: Internal-only serverless functions inaccessible from client RPCs.

3. **Untrusted Data Boundaries**:
   - Customer messages and uploaded documents are strictly treated as untrusted inputs.
   - User inputs are sanitized and isolated from privileged system prompts.

---

## 4. Production Baseline Checklist

| Domain | Status | Key Characteristics |
|---|---|---|
| **Security** | 🟡 Hardening | Input normalization, prompt injection defense, rate-limiting, PII masking |
| **Reliability** | 🟡 Hardening | Model routing, exponential backoff retries, timeouts, circuit breaker |
| **LLM & Tokens** | 🟡 Hardening | Centralized model config, strict maxTokens budgeting, sliding context window |
| **RAG Pipeline** | 🟡 Hardening | Multi-tenant search, query normalization, reranking fallback |
| **Agents & Tools**| 🟡 Hardening | Single `supportAgent`, structured tool schemas, error classification |
| **HITL** | 🟡 Hardening | Support queue handoff, AI conversation summaries, operator approval states |
| **Observability** | 🟡 Hardening | Structured logging, latency/token tracing, cost estimation |
| **Testing** | 🟡 Hardening | Unit tests, guardrail security tests, integration tests, eval framework |
| **CI/CD** | 🟡 Hardening | Automated GitHub Actions workflow with lint, typecheck, tests |
| **Cost Controls** | 🟡 Hardening | Semantic/retrieval caching, message caps, token budgets |
| **Performance** | ✅ Optimized | Zero N+1 listMessage queries, streaming responses, layout prefetching |
