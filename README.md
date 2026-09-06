# Aivon — AI Customer Support Platform

> An AI-powered customer support platform with a chat widget, dashboard for agents, and an embeddable script — all in a single Turborepo monorepo.

---

## Table of Contents

- [Project Description](#project-description)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [How to Run](#how-to-run)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Build & Deployment](#build--deployment)

---

## Project Description

Aivon is a full-stack, multi-tenant AI customer support platform. It allows businesses (organisations) to deploy an embeddable chat widget on their website that connects end-users to a RAG-powered AI support agent. The agent searches a per-organisation knowledge base to answer questions, can escalate conversations to human agents, and marks conversations as resolved — all in real time. Operators manage conversations, upload knowledge-base files, configure the widget, and integrate with third-party services (e.g. Vapi for voice) through a dedicated web dashboard.

---

## Tech Stack

| Category | Technology |
|---|---|
| **Monorepo Tooling** | [Turborepo](https://turbo.build/) v2, [pnpm](https://pnpm.io/) v10 Workspaces |
| **Frontend — Dashboard** | [Next.js](https://nextjs.org/) v15 (App Router), React v19, TypeScript 5.7 |
| **Frontend — Widget** | Next.js v15 (Turbopack), React v19, TypeScript 5.7 |
| **Frontend — Embed Script** | Vanilla TypeScript, [Vite](https://vitejs.dev/) v5 |
| **UI Components** | Shared `@workspace/ui` package (Radix-based, shadcn/ui conventions) |
| **State Management** | [Jotai](https://jotai.org/) v2 |
| **Forms** | React Hook Form v7 + Zod v3 |
| **Authentication** | [Clerk](https://clerk.com/) (multi-org, `@clerk/nextjs` v6) |
| **Backend / Database** | [Convex](https://convex.dev/) v1.25 (real-time serverless DB + functions) |
| **AI / LLM** | [Vercel AI SDK](https://sdk.vercel.ai/) v4, `@convex-dev/agent` v0.1, OpenAI models |
| **RAG** | `@convex-dev/rag` v0.3 (vector search over uploaded knowledge-base files) |
| **Voice Integration** | [Vapi AI](https://vapi.ai/) — `@vapi-ai/web` (client), `@vapi-ai/server-sdk` (backend) |
| **Secrets Management** | AWS Secrets Manager (`@aws-sdk/client-secrets-manager`) |
| **Webhook Validation** | [Svix](https://svix.com/) |
| **Error Monitoring** | [Sentry](https://sentry.io/) (`@sentry/nextjs` v9) |
| **Styling** | Tailwind CSS v4 (via PostCSS, shared through `@workspace/ui`) |
| **Linting / Formatting** | ESLint v9, Prettier v3 (shared via `@workspace/eslint-config`) |

---

## Prerequisites

| Requirement | Version |
|---|---|
| **Node.js** | `>= 20` |
| **pnpm** | `10.4.1` (set as `packageManager`) |
| **Convex account** | [convex.dev](https://convex.dev) |
| **Clerk account** | [clerk.com](https://clerk.com) |
| **OpenAI API key** | [platform.openai.com](https://platform.openai.com) |
| **AWS account** | Required for Secrets Manager (Vapi key storage) |
| **Vapi account** _(optional)_ | [vapi.ai](https://vapi.ai) — for voice support integration |
| **Sentry account** _(optional)_ | [sentry.io](https://sentry.io) — for error monitoring |

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/Yashgiradkar/Aivon.git
cd Aivon

# 2. Install all workspace dependencies
pnpm install

# 3. Bootstrap the Convex backend (first-time setup)
cd packages/backend
pnpm run setup   # runs: convex dev --until-success
```

---

## Environment Variables

Create the following `.env.local` files before running any app.

### `packages/backend/.env.local`

| Variable | Description |
|---|---|
| `CONVEX_DEPLOYMENT` | Your Convex deployment slug (e.g. `dev:your-slug`) |
| `CONVEX_URL` | Your Convex cloud URL |
| `CONVEX_SITE_URL` | Your Convex HTTP actions site URL |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk JWT issuer URL for token verification |
| `CLERK_SECRET_KEY` | Clerk backend secret key |
| `CLERK_WEBHOOK_SECRET` | Svix webhook secret for Clerk events |
| `OPENAI_API_KEY` | OpenAI API key for the AI support agent |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Secrets Manager |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for Secrets Manager |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |

### `apps/web/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Public Convex URL for the dashboard frontend |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` | Clerk frontend API URL |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side usage) |
| `NEXT_PUBLIC_CLERK_SIGNIN_URL` | Sign-in page path (e.g. `/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGNUP_URL` | Sign-up page path (e.g. `/sign-up`) |
| `NEXT_PUBLIC_CLERK_SIGNIN_FALLBACK_REDIRECT_URL` | Post-sign-in redirect |
| `NEXT_PUBLIC_CLERK_SIGNUP_FALLBACK_REDIRECT_URL` | Post-sign-up redirect |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map uploads |

### `apps/widget/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Public Convex URL for the widget frontend |

> **Note:** Never commit `.env.local` files. They are already listed in `.gitignore`.

---

## How to Run

### Development (all apps in parallel)

From the **repository root**:

```bash
pnpm dev
```

This uses Turborepo to start all packages concurrently:

| App | URL | Command |
|---|---|---|
| `apps/web` (Dashboard) | `http://localhost:3000` | `next dev --port 3000` |
| `apps/widget` (Chat Widget) | `http://localhost:3001` | `next dev --turbopack --port 3001` |
| `apps/embed` (Embed Script) | `http://localhost:3002` | `vite --port 3002` |
| `packages/backend` (Convex) | Convex Cloud | `convex dev` |

### Running a single app

```bash
# Dashboard only
cd apps/web && pnpm dev

# Widget only
cd apps/widget && pnpm dev

# Embed script only
cd apps/embed && pnpm dev

# Convex backend only
cd packages/backend && pnpm dev
```

### Embedding the widget on a website

After building the embed script, include it on any page with:

```html
<script
  src="https://your-domain.com/embed.js"
  data-organization-id="YOUR_ORG_ID"
  data-position="bottom-right"
  defer
></script>
```

The script exposes a global `EchoWidget` API for programmatic control:

```js
EchoWidget.show();
EchoWidget.hide();
EchoWidget.destroy();
EchoWidget.init({ organizationId: 'org_xxx', position: 'bottom-left' });
```

---

## Project Structure

```
Aivon/
├── apps/
│   ├── web/                  # Operator dashboard (Next.js 15, App Router)
│   │   ├── app/
│   │   │   ├── (auth)/       # Sign-in / Sign-up pages
│   │   │   └── (dashboard)/  # Protected dashboard routes
│   │   │       ├── conversations/   # Conversation inbox & detail view
│   │   │       ├── customization/   # Widget appearance settings
│   │   │       ├── files/           # Knowledge-base file uploads
│   │   │       ├── integrations/    # Third-party integrations
│   │   │       ├── plugins/         # Plugin management (e.g. Vapi)
│   │   │       └── billing/         # Subscription & billing
│   │   ├── components/       # Shared dashboard UI components
│   │   ├── modules/          # Feature modules (auth, dashboard, files, …)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utility functions
│   │   └── middleware.ts     # Clerk auth & org-redirect middleware
│   │
│   ├── widget/               # End-user chat widget (Next.js 15)
│   │   ├── app/              # Widget page & layout
│   │   ├── components/       # Widget-specific UI components
│   │   ├── modules/widget/   # Widget business logic
│   │   ├── hooks/            # Widget hooks
│   │   └── lib/              # Widget utilities
│   │
│   └── embed/                # Lightweight embeddable script (Vite + TS)
│       ├── embed.ts          # Self-contained IIFE embed script
│       ├── config.ts         # Widget URL & defaults
│       ├── icons.ts          # Inline SVG icons
│       └── demo.html         # Local embed demo page
│
├── packages/
│   ├── backend/              # Convex backend (DB, AI, HTTP actions)
│   │   └── convex/
│   │       ├── schema.ts             # Database schema
│   │       ├── convex.config.ts      # Agent + RAG plugins config
│   │       ├── http.ts               # HTTP actions (Clerk webhook)
│   │       ├── auth.config.ts        # Clerk JWT auth config
│   │       ├── public/               # Public Convex functions (widget-facing)
│   │       ├── private/              # Private Convex functions (dashboard-facing)
│   │       └── system/
│   │           ├── ai/
│   │           │   ├── agents/       # AI support agent definition
│   │           │   ├── tools/        # Agent tools (search, escalate, resolve)
│   │           │   └── constants.ts  # LLM system prompts
│   │           └── subscriptions.ts  # Subscription mutation
│   │
│   ├── ui/                   # Shared Radix/shadcn UI component library
│   ├── eslint-config/        # Shared ESLint configurations
│   ├── typescript-config/    # Shared tsconfig bases
│   └── math/                 # Shared math utilities
│
├── turbo.json                # Turborepo pipeline config
├── pnpm-workspace.yaml       # pnpm workspace definition
└── package.json              # Root scripts & devDependencies
```

---

## API Endpoints

The Convex backend exposes one HTTP action endpoint (registered in `http.ts`):

| Method | Path | Description |
|---|---|---|
| `POST` | `/clerk-webhook` | Receives Clerk `subscription.updated` webhook events; updates org membership limits and syncs subscription status in Convex. Validated with Svix. |

All other data operations (conversations, messages, widget settings, files, etc.) are handled via **Convex real-time queries and mutations** called directly from the frontend clients — not via traditional REST endpoints.

---

## Build & Deployment

### Production Build (all apps)

```bash
# From repository root
pnpm build
```

This runs `turbo build` which builds all apps in the correct dependency order:
1. `packages/ui`, `packages/backend` (shared packages first)
2. `apps/web`, `apps/widget`, `apps/embed`

Build outputs:
- `apps/web/.next/` — Next.js production bundle
- `apps/widget/.next/` — Next.js production bundle
- `apps/embed/dist/` — Vite bundle (the distributable `embed.js` script)

### Deploying the Convex Backend

```bash
cd packages/backend
npx convex deploy
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Format all TypeScript and Markdown files
pnpm format

# Type-check (from individual app directories)
pnpm typecheck
```

---