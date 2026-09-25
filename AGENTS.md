# AGENTS.md — Aivon AI Customer Support

> **For LLM coding agents.** Read this before modifying any code. All facts are derived from the actual codebase.

---

## Project Context

Aivon is a multi-tenant AI-powered customer support platform. Organizations embed a chat widget on their website; end-users interact with an AI support agent; human operators monitor and manage conversations from a dashboard. The platform is delivered as a **pnpm + Turborepo monorepo**.

Three applications + one shared backend compose the system:

| App | Port | Purpose |
|-----|------|---------|
| `apps/web` | 3000 | Operator dashboard (Next.js 15, Clerk-authenticated) |
| `apps/widget` | 3001 | End-user chat widget (Next.js 15, session-based) |
| `apps/embed` | 3002 | Embeddable JS script (Vite, no framework) |
| `packages/backend` | — | Convex backend (DB + serverless functions + AI) |

---

## Architecture and Important Modules

### Backend (`packages/backend/convex/`)

The entire backend runs on **Convex** (real-time database + serverless functions + file storage).

```
convex/
├── schema.ts           # Convex database schema — source of truth for all tables
├── auth.config.ts      # Clerk JWT provider configuration
├── http.ts             # HTTP routes (Clerk webhook handler)
├── convex.config.ts    # Registers @convex-dev/agent and @convex-dev/rag components
├── constants.ts        # SESSION_DURATION_MS = 24h
├── users.ts            # Stub users table (dev/test only)
├── playground.ts       # @convex-dev/agent-playground API exposure
├── public/             # Unauthenticated Convex functions (widget-facing)
│   ├── contactSessions.ts   # Session create/validate
│   ├── conversations.ts     # Widget conversation list/get/create
│   ├── messages.ts          # Widget message create/list + AI trigger
│   ├── widgetSettings.ts    # Fetch org widget settings
│   └── secrets.ts           # Fetch public Vapi keys for widget
├── private/            # Clerk-authenticated functions (dashboard-facing)
│   ├── conversations.ts     # Dashboard conversation list/get/status-update
│   ├── messages.ts          # Dashboard message create, AI enhancement
│   ├── widgetSettings.ts    # Upsert widget settings
│   ├── files.ts             # Knowledge base file upload/list/delete (RAG)
│   ├── plugins.ts           # Plugin registry (Vapi)
│   ├── secrets.ts           # Secret upsert (triggers system action)
│   └── vapi.ts              # Fetch Vapi assistants/phone numbers
├── system/             # Internal Convex functions (not callable from clients)
│   ├── ai/
│   │   ├── agents/supportAgent.ts   # GPT-4o-mini agent definition
│   │   ├── tools/
│   │   │   ├── search.ts            # RAG vector search tool
│   │   │   ├── escalateConversation.ts
│   │   │   └── resolveConversation.ts
│   │   ├── constants.ts             # All LLM system prompts
│   │   └── rag.ts                   # RAG instance (text-embedding-3-small, dim=1536)
│   ├── contactSessions.ts           # Session refresh (internal)
│   ├── conversations.ts             # Escalate/resolve mutations (internal)
│   ├── plugins.ts                   # Plugin upsert/get (internal)
│   ├── subscriptions.ts             # Subscription upsert/get (internal)
│   └── secrets.ts                   # AWS Secrets Manager upsert (internalAction)
└── lib/
    ├── secrets.ts            # AWS Secrets Manager client + helpers
    └── extractTextContent.ts # AI-powered file text extraction (image/PDF/text)
```

### Frontend Apps

**`apps/web/`** — Operator Dashboard
```
app/
├── (auth)/              # sign-in, sign-up, org-selection pages
└── (dashboard)/         # Protected dashboard routes
    ├── conversations/   # Conversations list + [conversationId] detail
    ├── customization/   # Widget customization settings
    ├── files/           # Knowledge base management
    ├── integrations/    # Embed snippet installation guide
    ├── plugins/vapi/    # Vapi voice assistant config
    └── billing/         # Plans & billing
modules/
├── dashboard/           # Conversations view, sidebar, panels
├── customization/       # Widget settings forms
├── files/               # File upload/list components
├── integrations/        # Embed code snippets
├── plugins/             # Vapi configuration UI
├── billing/             # Billing UI
└── auth/                # Auth UI components
```

**`apps/widget/`** — End-User Chat Widget
```
app/page.tsx             # Accepts ?organizationId= from embed script
modules/widget/
├── constants.ts         # Screen names, CONTACT_SESSION_KEY
├── atoms/               # Jotai state atoms
├── hooks/use-vapi.ts    # Vapi voice integration hook
└── ui/views/widget-view.tsx
```

**`apps/embed/`** — Embeddable Script
```
embed.ts      # IIFE that injects iframe + FAB into host page
config.ts     # WIDGET_URL, DEFAULT_POSITION
```

### Shared Packages

| Package | Purpose |
|---------|---------|
| `@workspace/ui` | Shared React components (shadcn/ui-based) |
| `@workspace/backend` | Re-exported Convex generated API types |
| `@workspace/eslint-config` | Shared ESLint config |
| `@workspace/typescript-config` | Shared tsconfig bases |

---

## Coding Conventions

1. **TypeScript strict** everywhere. Never use `any` unless required by Convex internals.
2. **Convex function namespacing**: `public/*` = no auth required; `private/*` = Clerk JWT required; `system/*` = internal only.
3. **Auth pattern in private functions**: Always call `ctx.auth.getUserIdentity()` first; check both `identity === null` and `!orgId`.
4. **Upsert pattern for settings**: Check existing record with `.unique()`, then `patch` or `insert`.
5. **Session validation in public functions**: Validate `contactSession.expiresAt < Date.now()`.
6. **Error format**: Always `throw new ConvexError({ code: string, message: string })`. Codes: `UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST`.
7. **Module structure in apps**: Each feature lives in `modules/<feature>/ui/{views,components,layouts}`.
8. **Import paths**: Use `@workspace/backend/_generated/api` for Convex API; `@workspace/ui/components/*` for UI.
9. **RAG namespace**: Always set `namespace: orgId` when calling `rag.add()` or `rag.search()`.

---

## Directory / Module Responsibilities

| Path | Responsibility |
|------|---------------|
| `convex/schema.ts` | Only place to define/modify database tables |
| `convex/auth.config.ts` | Clerk JWT domain config |
| `convex/http.ts` | Webhook receiver (Clerk subscription events via Svix) |
| `convex/public/` | Functions callable by the widget without authentication |
| `convex/private/` | Functions callable by the dashboard with Clerk auth |
| `convex/system/` | Internal-only functions; never call from clients |
| `convex/lib/secrets.ts` | All AWS Secrets Manager operations |
| `convex/lib/extractTextContent.ts` | File → text pipeline for RAG indexing |
| `convex/system/ai/constants.ts` | All LLM system prompts |
| `apps/embed/embed.ts` | The customer-facing JS snippet logic |
| `apps/web/middleware.ts` | Clerk auth enforcement + org-selection redirect |

---

## Critical Constraints and Invariants

1. **Subscription gate**: AI features (`messages.ts:create` AI trigger, `messages.ts:enhanceResponse`, `files.ts:addFile`) require `subscription.status === "active"`.
2. **Org isolation**: Every private query verifies `conversation.organizationId === orgId`. Every RAG call uses `namespace: orgId`.
3. **Session expiry**: `SESSION_DURATION_MS = 24h`. Auto-refresh when `timeRemaining < 4h`.
4. **Conversation status machine**: `unresolved → escalated → resolved`. Once `resolved`, no new messages.
5. **Secret naming**: AWS Secrets Manager uses `tenant/{organizationId}/{service}` pattern.
6. **Embed IIFE**: `apps/embed/embed.ts` must remain dependency-free (no npm imports at runtime).

---

## Safe Modification Guidelines

### Adding a new dashboard page
1. Add a route in `apps/web/app/(dashboard)/<page>/page.tsx`
2. Create the view in `apps/web/modules/<feature>/ui/views/`
3. Add sidebar entry in `apps/web/modules/dashboard/ui/components/dashboard-sidebar.tsx`

### Adding a new AI tool
1. Create `convex/system/ai/tools/<toolName>.ts` using `createTool` from `@convex-dev/agent`
2. Add prompt guidance to `convex/system/ai/constants.ts`
3. Register the tool in `convex/public/messages.ts` in the `tools` object

### Adding a new plugin/integration
1. Add the service to `v.union()` in: `schema.ts`, `private/plugins.ts`, `private/secrets.ts`, `system/plugins.ts`, `system/secrets.ts`
2. Add API in `convex/private/<newService>.ts`
3. Add UI in `apps/web/modules/plugins/` and route in `apps/web/app/(dashboard)/plugins/<new>/`

### Modifying the database schema
1. Edit `convex/schema.ts`
2. Run `npx convex dev` — Convex auto-applies schema changes

---

## Build / Run Commands

```bash
# Root (run all apps concurrently)
pnpm dev

# Individual apps
cd apps/web && pnpm dev          # Dashboard at :3000
cd apps/widget && pnpm dev       # Widget at :3001
cd apps/embed && pnpm dev        # Embed script dev server at :3002
cd packages/backend && pnpm dev  # Convex dev server

# First-time backend setup
cd packages/backend && pnpm setup

# Build all
pnpm build

# Lint all
pnpm lint

# Format
pnpm format

# Type check (per app)
pnpm typecheck
```

---

## Common Pitfalls

1. **Forgetting `namespace: orgId` in RAG calls** — data leaks across orgs.
2. **Calling `internal.*` from public/private functions** — only allowed from `system/*` or via `ctx.scheduler`.
3. **Widget queries need `contactSessionId`** — all public data-fetch functions require this for auth.
4. **`users.ts:add` throws intentionally** — it has `throw new Error("Tracking test")` for Sentry testing.
5. **Convex actions vs mutations** — actions call external APIs but cannot write DB directly; use `ctx.runMutation()`.
6. **Embed widget URL** — `WIDGET_URL` in `apps/embed/config.ts` must match the deployed widget URL.
7. **Session not refreshed** — sessions auto-refresh only when a new message is sent. Idle sessions expire after 24h.

---

## Rules for Extending Existing Functionality

- Never remove existing `ConvexError` codes — clients depend on them.
- Never change `SESSION_DURATION_MS` without also updating `AUTO_REFRESH_THRESHOLD_MS`.
- The `supportAgent` must stay as the single agent — it is referenced in playground, tools, and all message flows.
- Add subscription checks early in new gated handlers, consistent with existing patterns.
- Keep `public/` vs `private/` separation strict — public functions must never assume Clerk auth.

---

> Also read: `packages/backend/convex/_generated/ai/guidelines.md` before writing any Convex code.
