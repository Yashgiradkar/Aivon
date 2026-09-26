# Changelog

> Meaningful changes to the Aivon AI Customer Support platform.
> Format: grouped by feature area. Dates are inferred from project context (2026).

---

## [Unreleased]

_Active development._

---

## [0.0.1] — 2026

### Backend (Convex)

- **Schema**: Defined core tables: `subscriptions`, `widgetSettings`, `plugins`, `conversations`, `contactSessions`, `users`
- **Auth**: Configured Clerk JWT authentication via `auth.config.ts` with `CLERK_JWT_ISSUER_DOMAIN`
- **Webhook**: Implemented `/clerk-webhook` HTTP route to handle `subscription.updated` events via Svix signature verification; auto-adjusts Clerk org `maxAllowedMemberships` (5 active / 1 inactive)
- **AI Agent**: Integrated `@convex-dev/agent` with GPT-4o-mini as `supportAgent`; defined `SUPPORT_AGENT_PROMPT`, `SEARCH_INTERPRETER_PROMPT`, and `OPERATOR_MESSAGE_ENHANCEMENT_PROMPT`
- **AI Tools**: Implemented `search` (RAG vector search), `escalateConversation`, and `resolveConversation` tools
- **RAG**: Integrated `@convex-dev/rag` with OpenAI `text-embedding-3-small` (1536 dimensions), namespace-scoped per organization
- **File Processing**: AI-powered text extraction for images (gpt-4o-mini vision), PDFs (gpt-4o), and text files; content hash deduplication
- **Contact Sessions**: Implemented 24h session system with auto-refresh (4h threshold)
- **Conversation States**: Implemented `unresolved → escalated → resolved` state machine
- **Secrets**: Integrated AWS Secrets Manager for per-org Vapi API key storage; pattern `tenant/{orgId}/vapi`
- **Plugins**: Plugin registry supporting Vapi integration
- **Subscriptions**: Subscription gate on AI features (agent responses, file uploads, message enhancement)
- **Agent Playground**: Exposed `supportAgent` via `@convex-dev/agent-playground` for development testing

### Dashboard (`apps/web`)

- **Auth**: Clerk authentication with organization enforcement; middleware redirects unauthenticated users to `/sign-in` and users without org to `/org-selection`
- **Conversations**: List view with status filtering (unresolved/escalated/resolved); real-time updates via Convex subscriptions
- **Conversation Detail**: Message thread view with operator message composer and AI enhancement button
- **Knowledge Base** (`/files`): File upload, list, and delete interface
- **Widget Customization** (`/customization`): Greeting message and default suggestions configuration
- **Integrations** (`/integrations`): HTML/React/Next.js/JavaScript embed code snippet generator
- **Vapi Voice Assistant** (`/plugins/vapi`): Vapi account connection, assistant/phone number selection
- **Plans & Billing** (`/billing`): Billing management interface
- **Sidebar**: Collapsible sidebar with icon-only mode; Clerk `OrganizationSwitcher` and `UserButton`
- **Error Tracking**: Sentry integration (`@sentry/nextjs`) with tunnel route `/monitoring`

### Widget (`apps/widget`)

- **Screen System**: Defined widget screens: `loading`, `error`, `selection`, `auth`, `inbox`, `chat`, `contact`, `voice`
- **Session Persistence**: Contact session stored in `localStorage` under `echo_contact_session`
- **AI Chat**: Real-time message delivery via Convex subscriptions; AI agent responds to unresolved conversations
- **Voice Support**: Vapi web SDK integration for voice calls
- **Organization ID**: Read from `?organizationId=` URL query param (set by embed script)

### Embed Script (`apps/embed`)

- **IIFE Bundle**: Self-contained JavaScript bundle built with Vite
- **Widget Injection**: Creates floating action button (blue, `z-index: 999999`) and iframe (`z-index: 999998`)
- **Positioning**: Configurable `bottom-right` / `bottom-left` position via `data-position` attribute
- **Animation**: CSS opacity + translateY transition on show/hide
- **postMessage API**: Handles `close` and `resize` messages from widget iframe
- **JavaScript API**: Exposes `window.EchoWidget.{ init, show, hide, destroy }`
- **iframe Permissions**: `allow="microphone; clipboard-read; clipboard-write"` for Vapi voice support

### Infrastructure

- **Monorepo**: Turborepo + pnpm workspaces; apps at `:3000`, `:3001`, `:3002`
- **Shared UI**: `@workspace/ui` package with shadcn/ui components and Geist font
- **TypeScript**: Strict TypeScript across all packages; shared `tsconfig` bases
- **Fonts**: Geist (sans) and Geist Mono throughout both Next.js apps


### Human Queue Support

| Phase | Tasks |
|-------|-------|
| **Phase 1: Backend Schema & Core Functions** | Update `schema.ts`, create `public/queue.ts`, `private/queue.ts`, `system/queue.ts`, upgrade `escalateConversation.ts`. |
| **Phase 2: Context Handoff & Summarization** | Add AI summary generator function triggered upon escalation. |
| **Phase 3: Widget Queue & Real-Time UX** | Add queue atoms, widget queue status banner in chat, callback scheduling modal, and live queue-to-call transition in `apps/widget`. |
| **Phase 4: Operator Dashboard Integration** | Add Agent Presence Switch, Live Queue Drawer/Panel, and Call Handling UI in `apps/web`. |
| **Phase 5: Validation & Documentation** | Type-checking, end-to-end verification, and updating `AGENTS.md` + `docs/architecture.md`. |