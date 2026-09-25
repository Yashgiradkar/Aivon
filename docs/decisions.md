# Architectural Decisions

> **Note:** This document records significant decisions inferred from the codebase. Decisions marked `[Inferred]` are derived from code evidence, not from historical records. Decisions marked `[Confirmed]` are directly evident from the implementation.

---

## ADR-001: Convex as the Backend Platform

**Status:** Confirmed  
**Evidence:** Entire `packages/backend/` is Convex; all data operations use Convex SDK.

**Decision:** Use Convex as the sole backend platform (database, serverless functions, file storage, real-time subscriptions).

**Context:** A customer support platform needs real-time message delivery to both the operator dashboard and the end-user widget. Traditional REST APIs require polling or a separate WebSocket layer.

**Alternatives considered:** `[Inferred]` Traditional REST API with Supabase or Firebase; custom WebSocket server.

**Trade-offs:**
- ✅ Built-in real-time subscriptions — no polling, no WebSocket server to manage
- ✅ Serverless — no infrastructure to manage
- ✅ TypeScript-first with end-to-end type safety via generated types
- ✅ Built-in file storage
- ❌ Vendor lock-in to Convex platform
- ❌ All business logic must live in Convex functions (no traditional REST layer)

**Consequences:** All data access goes through Convex queries/mutations/actions. No REST API exists.

---

## ADR-002: Three-App Monorepo (Dashboard + Widget + Embed)

**Status:** Confirmed  
**Evidence:** `apps/web/`, `apps/widget/`, `apps/embed/` are separate applications.

**Decision:** Separate the operator dashboard, end-user widget, and embed script into three distinct applications within a Turborepo monorepo.

**Context:** The widget is embedded in third-party websites via an iframe. It has fundamentally different auth requirements (session-based vs. Clerk JWT) and UX requirements (compact, mobile-first) from the dashboard.

**Trade-offs:**
- ✅ Clear separation of concerns and deployment targets
- ✅ Widget can be deployed independently without dashboard downtime
- ✅ Different Next.js configs (e.g., no Sentry on widget, Turbopack on widget)
- ❌ Shared code must be in `packages/` — adds coordination overhead

**Consequences:** Shared UI components live in `@workspace/ui`. Convex types are shared via `@workspace/backend`.

---

## ADR-003: Session-Based Auth for Widget

**Status:** Confirmed  
**Evidence:** `public/contactSessions.ts`, `CONTACT_SESSION_KEY` in localStorage, expiry check in every public function.

**Decision:** The widget uses a custom session system (DB-stored `contactSessions` with 24h TTL) instead of Clerk.

**Context:** Widget end-users are anonymous visitors — they should not need to create a Clerk account. The widget captures name + email for identification, then issues a session.

**Trade-offs:**
- ✅ No Clerk dependency in the widget — simpler for end-users
- ✅ Session stored in DB allows server-side validation
- ❌ Custom session management is additional complexity vs. a standard auth library
- ❌ Sessions are not revocable except by DB deletion

**Consequences:** Every `public/` function must explicitly validate the session. Auto-refresh logic must be maintained.

---

## ADR-004: AWS Secrets Manager for Third-Party API Keys

**Status:** Confirmed  
**Evidence:** `lib/secrets.ts` uses `@aws-sdk/client-secrets-manager`; secret naming pattern `tenant/{orgId}/{service}`.

**Decision:** Store third-party API keys (e.g., Vapi) in AWS Secrets Manager, not in the Convex database.

**Context:** Multi-tenant SaaS requires storing per-org API keys securely. Convex's database is a good fit for application data but is not a secrets vault.

**Alternatives considered:** `[Inferred]` Encrypted fields in Convex DB; Convex environment variables (not multi-tenant).

**Trade-offs:**
- ✅ Purpose-built secret storage with audit logging and access control
- ✅ Secrets never appear in Convex DB or logs
- ❌ AWS dependency adds infrastructure complexity
- ❌ Convex mutations cannot call AWS directly — requires scheduler pattern

**Consequences:** The `ctx.scheduler.runAfter(0, ...)` pattern in `private/secrets.ts` is required because mutations cannot call external APIs. A pointer (`secretName`) is stored in the `plugins` table for lookup.

---

## ADR-005: `@convex-dev/agent` for AI Conversation Management

**Status:** Confirmed  
**Evidence:** `convex.config.ts` uses `agent` component; `supportAgent.ts` uses `Agent` class.

**Decision:** Use `@convex-dev/agent` (Convex's AI agent component) for managing AI conversation threads and message history.

**Context:** AI conversations require persistent thread state. Building this from scratch on Convex would require custom message storage, thread management, and AI SDK integration.

**Trade-offs:**
- ✅ Thread management, message persistence, and AI SDK integration handled by the component
- ✅ Agent playground (`playground.ts`) available for development/debugging
- ❌ Component is relatively new (v0.1.16) — API may change
- ❌ Message format is controlled by the component, not fully customizable

**Consequences:** All AI message storage is via `saveMessage`/`listMessages` from `@convex-dev/agent`. The `threadId` is the primary key linking conversations to AI threads.

---

## ADR-006: Namespace-Scoped RAG per Organization

**Status:** Confirmed  
**Evidence:** `namespace: orgId` in every `rag.add()` and `rag.search()` call; comment in `private/files.ts`.

**Decision:** Each organization's knowledge base is a separate RAG namespace, preventing cross-tenant search.

**Context:** Multi-tenant knowledge bases must be isolated. An org's uploaded files must not be searchable by other orgs' AI agents.

**Trade-offs:**
- ✅ Hard isolation — search cannot cross namespace boundaries
- ✅ Clean deletion — all files for an org can be cleared by namespace
- ❌ Cannot share a global knowledge base across orgs (intentional)

**Consequences:** The critical comment in `private/files.ts`: `// SUPER IMPORTANT: What search space to add this to. You cannot search across namespaces`.

---

## ADR-007: Subscription Gate for AI Features

**Status:** Confirmed  
**Evidence:** `subscription?.status !== "active"` checks in `messages.ts` (both public and private) and `files.ts`.

**Decision:** AI agent responses, message enhancement, and file upload/indexing are gated behind an active subscription.

**Context:** These features have significant compute costs (OpenAI API calls). Free-tier organizations should not consume AI resources.

**Trade-offs:**
- ✅ Clear revenue model — AI features require a paid subscription
- ✅ Prevents abuse by inactive/free organizations
- ❌ Subscription status is derived from Clerk webhooks — network failures could leave status stale

**Consequences:** The `/clerk-webhook` HTTP endpoint must reliably receive and process `subscription.updated` events. Subscription status updates also modify org `maxAllowedMemberships` in Clerk (5 for active, 1 for inactive).

---

## ADR-008: AI-Powered File Text Extraction

**Status:** Confirmed  
**Evidence:** `lib/extractTextContent.ts` uses `gpt-4o-mini` for images, `gpt-4o` for PDFs and HTML.

**Decision:** Use OpenAI's vision and file capabilities (not a PDF parsing library) to extract text from uploaded files.

**Context:** Knowledge base files may be images of documents, PDFs, or HTML. A vision model can handle all cases uniformly without separate parsing libraries per format.

**Trade-offs:**
- ✅ Single implementation handles images, PDFs, and structured text
- ✅ Can extract text from scanned documents (images)
- ❌ More expensive than a traditional PDF library for pure-text PDFs
- ❌ Quality depends on OpenAI model capabilities; may miss complex formatting

**Consequences:** PDF extraction uses `gpt-4o` (more capable than `gpt-4o-mini`) due to document complexity. This is encoded in the `AI_MODELS` object in `extractTextContent.ts`.
