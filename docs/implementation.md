# Implementation Guide

> See also: [architecture.md](./architecture.md) · [api.md](./api.md)

---

## Core Business Logic

### Multi-Tenant Data Isolation

Every piece of data in the system is scoped to an `organizationId` (a Clerk organization ID string). This is the central invariant of the system.

- **Dashboard functions** (`private/`): extract `orgId` from `identity.orgId` (Clerk JWT claim) — cannot be spoofed by the client.
- **Widget functions** (`public/`): accept `organizationId` as a function argument, but data is authorized through `contactSessionId` which is DB-bound to a specific org.
- **RAG knowledge base**: scoped by `namespace: orgId` — search cannot cross org boundaries.
- **AWS secrets**: key pattern `tenant/{organizationId}/{service}` — one secret per org per plugin.

**Why this way**: Convex does not have row-level security in the traditional sense. All access control must be enforced explicitly in each function handler. The pattern of `identity.orgId` extraction + comparison against the record's `organizationId` is the enforced pattern.

---

## Contact Session System

The widget has no Clerk auth. Instead, it uses a lightweight session system:

```typescript
// Session created when user submits contact form
const contactSessionId = await ctx.db.insert("contactSessions", {
  name, email, organizationId,
  expiresAt: Date.now() + SESSION_DURATION_MS  // 24h
});
```

**Storage**: Session ID is stored in browser `localStorage` under the key `echo_contact_session`.

**Validation**: Every `public/` function that reads data validates:
```typescript
if (!contactSession || contactSession.expiresAt < Date.now()) {
  throw new ConvexError({ code: "UNAUTHORIZED", message: "Invalid session" });
}
```

**Auto-refresh**: On every message sent, `system/contactSessions.refresh` is called. If less than 4 hours remain on the session, it is extended by a full `SESSION_DURATION_MS` (24h). This keeps active users from being logged out.

**Metadata**: The widget captures browser metadata on session creation (user agent, language, screen resolution, timezone, referrer, current URL) — this appears in the operator's contact panel.

---

## Conversation State Machine

Conversations follow a strict linear state progression:

```
unresolved ──► escalated ──► resolved
     │                           ▲
     └───────────────────────────┘
```

| Transition | Trigger | Handler |
|-----------|---------|---------|
| `unresolved → escalated` | AI tool calls `escalateConversation`, OR operator sends first message | `system/conversations.ts:escalate`, `private/messages.ts:create` |
| `escalated → resolved` | AI tool calls `resolveConversation`, OR operator manually resolves | `system/conversations.ts:resolve`, `private/conversations.ts:updateStatus` |
| `unresolved → resolved` | Operator manual override | `private/conversations.ts:updateStatus` |

**Why this matters**: Both `public/messages.ts:create` and `private/messages.ts:create` check `conversation.status === "resolved"` and throw `BAD_REQUEST` if true. Resolved conversations are immutable.

When an operator sends a message to an `unresolved` conversation, it is automatically escalated:
```typescript
if (conversation.status === "unresolved") {
  await ctx.db.patch(args.conversationId, { status: "escalated" });
}
```
This ensures escalated conversations clearly show human intervention.

---

## AI Agent Architecture

### Support Agent

```typescript
// convex/system/ai/agents/supportAgent.ts
export const supportAgent = new Agent(components.agent, {
  chat: openai.chat("gpt-4o-mini"),
  instructions: SUPPORT_AGENT_PROMPT,
});
```

The agent is built on `@convex-dev/agent` which wraps the Vercel AI SDK. It maintains conversation threads in Convex (managed by the component internally).

### Message Flow (AI-gated)

```typescript
// Only runs AI if:
// 1. Subscription is active, AND
// 2. Conversation is not escalated (status === "unresolved")
const shouldTriggerAgent =
  conversation.status === "unresolved" && subscription?.status === "active";
```

If the conversation is `escalated`, only the message is saved (the operator handles it). If the subscription is inactive, only the message is saved (no AI response).

### AI Tools

The agent has three tools available during generation:

| Tool | Action | Outcome |
|------|--------|---------|
| `searchTool` | Vector search on org's knowledge base (RAG) | Returns interpreted answer |
| `escalateConversationTool` | Calls `system/conversations.escalate` | Sets status = "escalated", saves escalation message |
| `resolveConversationTool` | Calls `system/conversations.resolve` | Sets status = "resolved", saves resolution message |

**Search tool double-LLM pattern**: The search tool does not return raw RAG results. It passes results through a secondary `gpt-4o-mini` call with `SEARCH_INTERPRETER_PROMPT` to produce a conversational response. This response is then saved as an assistant message in the thread.

### Operator Message Enhancement

Dashboard operators can enhance their typed message with AI before sending:
```typescript
// private/messages.ts:enhanceResponse
const response = await generateText({
  model: openai("gpt-4o-mini"),
  messages: [
    { role: "system", content: OPERATOR_MESSAGE_ENHANCEMENT_PROMPT },
    { role: "user", content: args.prompt },
  ],
});
```
This uses `gpt-4o-mini` directly (not through the agent) and returns the enhanced text for the operator to review/edit before sending.

---

## RAG (Knowledge Base)

### Pipeline

```
File Upload → Convex Storage → extractTextContent() → rag.add() → Vectorized Index
```

### Text Extraction (`convex/lib/extractTextContent.ts`)

| MIME Type | Model Used | Method |
|-----------|-----------|--------|
| `image/jpeg`, `image/png`, `image/webp`, `image/gif` | `gpt-4o-mini` (vision) | Describe/transcribe image |
| `application/pdf` | `gpt-4o` | Extract text from PDF file |
| `text/plain` | None (direct decode) | `TextDecoder` |
| Other `text/*` (HTML, etc.) | `gpt-4o` | Convert to markdown |

**Why PDF uses gpt-4o**: PDF text extraction requires understanding document structure; `gpt-4o` has stronger PDF file understanding than `gpt-4o-mini`.

### Content Deduplication

Files are deduplicated by content hash:
```typescript
const { entryId, created } = await rag.add(ctx, {
  namespace: orgId,
  contentHash: await contentHashFromArrayBuffer(bytes),
  ...
});

if (!created) {
  // Entry already exists — delete the duplicate storage blob
  await ctx.storage.delete(storageId);
}
```

This prevents double-indexing if the same file is uploaded twice.

### Search

During AI generation, the `search` tool queries RAG with `limit: 5` results, all scoped to the org's namespace. Results are formatted and passed to the interpreter LLM.

---

## Plugin / Secrets Architecture

Plugins are third-party service integrations (currently only `vapi`). Their credentials are stored in AWS Secrets Manager — never in Convex's database.

### Flow: Connecting Vapi

```
Operator submits Vapi API keys
         ↓
private/secrets.ts:upsert (mutation)
         ↓
ctx.scheduler.runAfter(0, system/secrets.upsert)  ← deferred to action
         ↓
system/secrets.ts:upsert (internalAction)
         ↓
lib/secrets.ts:upsertSecret → AWS Secrets Manager (CreateSecret or PutSecretValue)
         ↓
system/plugins.ts:upsert ← records secretName in plugins table
```

**Why deferred via scheduler**: Convex mutations cannot call external APIs. By using `ctx.scheduler.runAfter(0, ...)`, the mutation completes, then an action runs immediately after to call AWS.

### Flow: Reading Vapi Credentials

```
private/vapi.ts:getAssistants (action)
    → system/plugins.getByOrganizationIdAndService → get secretName from DB
    → lib/secrets.getSecretValue(secretName) → AWS Secrets Manager
    → parseSecretString → { privateApiKey, publicApiKey }
    → VapiClient(privateApiKey).assistants.list()
```

For the **widget** (public), only the `publicApiKey` is returned via `public/secrets.ts:getVapiSecrets`.

---

## Subscription Gate

All subscription checking follows this pattern:

```typescript
const subscription = await ctx.runQuery(
  internal.system.subscriptions.getByOrganizationId,
  { organizationId: orgId },
);

if (subscription?.status !== "active") {
  throw new ConvexError({ code: "BAD_REQUEST", message: "Missing subscription" });
}
```

Subscription records are created/updated via the Clerk webhook (`http.ts`). When `subscription.updated` fires and `status === "active"`, Clerk org `maxAllowedMemberships` is set to 5 (vs 1 for inactive).

---

## Widget Screens

The widget has a defined set of screens managed by Jotai atoms:

| Screen | Purpose |
|--------|---------|
| `loading` | Initial load state |
| `error` | Error state |
| `selection` | Choose chat vs voice |
| `auth` | Contact form (name + email) |
| `inbox` | List of past conversations |
| `chat` | Active conversation |
| `contact` | Contact details view |
| `voice` | Vapi voice call interface |

Screen transitions are managed client-side via Jotai. The session (`CONTACT_SESSION_KEY` in localStorage) persists across page refreshes.

---

## Embed Script Architecture

`apps/embed/embed.ts` is a self-executing IIFE bundled to a single file (`dist/widget.js`) by Vite:

1. Reads `data-organization-id` and `data-position` from the `<script>` tag
2. Creates a floating action button (FAB) with `z-index: 999999`
3. Creates an iframe loading `WIDGET_URL?organizationId=<id>` with `z-index: 999998`
4. FAB toggles iframe visibility with CSS opacity/transform animation
5. Listens for `postMessage` from widget iframe:
   - `{ type: "close" }` → hides the widget
   - `{ type: "resize", payload: { height } }` → resizes iframe height
6. Exposes `window.EchoWidget` API: `{ init, show, hide, destroy }`

**iframe permissions**: `allow="microphone; clipboard-read; clipboard-write"` — required for Vapi voice calls.

---

## Error Handling

### Convex Error Format

All Convex functions use `ConvexError` with a structured payload:
```typescript
throw new ConvexError({ code: "UNAUTHORIZED" | "NOT_FOUND" | "BAD_REQUEST", message: string });
```

Clients should handle errors by checking `error.data.code`.

### Sentry Integration

`apps/web` is instrumented with Sentry via `@sentry/nextjs`:
- `instrumentation.ts` — server-side initialization
- `instrumentation-client.ts` — client-side initialization  
- `sentry.edge.config.ts` — edge runtime config
- `global-error.tsx` — React error boundary reporting
- Tunnel route: `/monitoring` (proxies browser requests to Sentry to bypass ad-blockers)

---

## Reusable Components and Services

### `@workspace/ui`

Shared React component library based on shadcn/ui. Components are imported as:
```typescript
import { Button } from "@workspace/ui/components/button";
import { Sidebar } from "@workspace/ui/components/sidebar";
```

Global CSS (Tailwind-based) is imported in each app's layout:
```typescript
import "@workspace/ui/globals.css";
```

### Convex Providers

Both `apps/web` and `apps/widget` wrap their apps in a `<Providers>` component that sets up the Convex client. The Convex URL is read from `NEXT_PUBLIC_CONVEX_URL`.

### Jotai State

Client-side state (active screen, session, etc.) uses Jotai atoms. Jotai's `Provider` is included in the app `<Providers>`. Atoms are co-located with their feature module.

---

## Caching

- **Convex real-time queries**: Results are automatically cached and invalidated by Convex when underlying data changes. No manual cache management needed.
- **RAG content hash**: Prevents re-processing duplicate files.
- **No additional caching layer** exists (no Redis, no CDN caching of API responses).

---

## Validation

- **Convex function arguments**: Validated by Convex's `v.*` validators at runtime (schema-level).
- **Form inputs**: Validated with Zod schemas via `react-hook-form` + `@hookform/resolvers/zod`.
- **File type detection**: `guessMimeTypeFromExtension` + `guessMimeTypeFromContents` from `@convex-dev/rag` with fallback to `application/octet-stream`.
