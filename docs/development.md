# Development Guide

> See also: [architecture.md](./architecture.md) · [api.md](./api.md)

---

## Prerequisites

| Tool | Required Version |
|------|-----------------|
| Node.js | >= 20 |
| pnpm | 10.4.1 (pinned via `packageManager`) |
| Convex CLI | Installed via `npx convex` |

---

## Installation & Setup

```bash
# Clone the repository
git clone <repo-url>
cd "Aivon - AI Customer Support"

# Install all dependencies (installs for all apps and packages)
pnpm install
```

### Environment Configuration

Each package/app has its own `.env.local` (gitignored). Create these files before running anything.

#### `packages/backend/.env.local`
```env
# Convex deployment (set automatically after first npx convex dev)
CONVEX_DEPLOYMENT=dev:<deployment-slug>
CONVEX_URL=https://<deployment-slug>.convex.cloud
CONVEX_SITE_URL=https://<deployment-slug>.convex.site

# Clerk
CLERK_JWT_ISSUER_DOMAIN=https://<your-clerk-domain>.clerk.accounts.dev
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# OpenAI
OPENAI_API_KEY=sk-proj-...

# AWS Secrets Manager (for Vapi API key storage)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

#### `apps/web/.env.local`
```env
NEXT_PUBLIC_CONVEX_URL=https://<deployment-slug>.convex.cloud

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

NEXT_PUBLIC_CLERK_SIGNIN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGNUP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGNIN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGNUP_FALLBACK_REDIRECT_URL=/

# Optional: Sentry error tracking
SENTRY_AUTH_TOKEN=...
```

#### `apps/widget/.env.local`
```env
NEXT_PUBLIC_CONVEX_URL=https://<deployment-slug>.convex.cloud
```

#### `apps/embed/` (no `.env.local`)
Embed uses `VITE_WIDGET_URL` set in `apps/embed/config.ts`. For local dev, it defaults to `http://localhost:3001`.

---

## Running Locally

You need two terminal sessions for full local development:

### Terminal 1 — Backend (Convex)
```bash
# First-time setup (runs until Convex deployment is ready)
cd packages/backend
pnpm setup

# Subsequent runs
pnpm dev    # watches convex/ directory and hot-reloads
```

### Terminal 2 — Frontend Apps
```bash
# Run all apps concurrently (from root)
pnpm dev

# Or run individually:
cd apps/web && pnpm dev          # http://localhost:3000
cd apps/widget && pnpm dev       # http://localhost:3001 (Turbopack)
cd apps/embed && pnpm dev        # http://localhost:3002
```

The root `pnpm dev` runs all apps in parallel via Turborepo.

### Accessing the Apps

| URL | App |
|-----|-----|
| http://localhost:3000 | Operator dashboard (requires Clerk login + org) |
| http://localhost:3001?organizationId=<orgId> | Widget (requires a valid org ID) |
| http://localhost:3002 | Embed script dev/demo page |

---

## Build

```bash
# Build all apps
pnpm build

# Build individual apps
cd apps/web && pnpm build
cd apps/widget && pnpm build
cd apps/embed && pnpm build
```

Outputs:
- `apps/web/.next/` — Next.js build
- `apps/widget/.next/` — Next.js build
- `apps/embed/dist/` — Vite bundle (the embeddable `widget.js`)

---

## Lint & Format

```bash
# Lint all packages
pnpm lint

# Lint with auto-fix
cd apps/web && pnpm lint:fix
cd apps/widget && pnpm lint:fix

# Format (Prettier)
pnpm format    # formats **/*.{ts,tsx,md}
```

---

## Type Checking

```bash
cd apps/web && pnpm typecheck
cd apps/widget && pnpm typecheck
```

---

## Code Organization

The monorepo is organized as a pnpm workspace + Turborepo:

```
/
├── apps/
│   ├── web/              # Operator dashboard
│   │   ├── app/          # Next.js App Router routes
│   │   ├── components/   # App-level shared components (providers, etc.)
│   │   ├── hooks/        # App-level hooks
│   │   ├── lib/          # App-level utilities
│   │   └── modules/      # Feature modules (domain-organized)
│   ├── widget/           # End-user chat widget
│   │   ├── app/          # Next.js App Router (single page)
│   │   ├── components/   # Widget-level components
│   │   ├── hooks/        # Widget-level hooks
│   │   └── modules/      # Widget feature modules
│   └── embed/            # Embeddable script (Vite + IIFE)
├── packages/
│   ├── backend/          # Convex backend
│   │   └── convex/       # All Convex functions and schema
│   ├── ui/               # Shared component library
│   ├── eslint-config/    # Shared ESLint config
│   ├── typescript-config/# Shared tsconfig
│   └── math/             # (placeholder/utility package)
├── package.json          # Root scripts + packageManager
├── pnpm-workspace.yaml   # Workspace package paths
└── turbo.json            # Turborepo pipeline config
```

### Module Structure (Feature Modules)

Each feature module in `apps/web/modules/` or `apps/widget/modules/` follows:
```
modules/<feature>/
├── ui/
│   ├── views/     # Full-page view components
│   ├── components/# Reusable sub-components
│   └── layouts/   # Layout wrappers
├── constants.ts   # Feature constants
├── types.ts       # TypeScript types
├── atoms.ts       # Jotai state atoms (if any)
├── schemas.ts     # Zod validation schemas (if any)
└── hooks/         # Custom React hooks (if any)
```

---

## Coding Conventions

1. **File naming**: kebab-case for all files (`conversation-id-view.tsx`, `use-vapi.ts`).
2. **Component naming**: PascalCase exports (`ConversationIdView`, `DashboardSidebar`).
3. **`"use client"` directive**: Required for components using hooks, event handlers, or browser APIs.
4. **Server vs client**: Next.js pages are server components by default. Add `"use client"` only when needed.
5. **Convex hooks**: Use `useQuery` for real-time data, `useMutation` for writes, `useAction` for external API calls.
6. **State management**: Use `jotai` atoms for cross-component widget/dashboard state.
7. **Forms**: Use `react-hook-form` + `zod` + `@hookform/resolvers` for all forms.
8. **UI components**: Always use `@workspace/ui/components/*` — do not install shadcn directly in apps.

---

## Branch / PR Expectations

No CI/CD configuration files were found in the repository. Branch and PR conventions are not codified in the codebase.

---

## Debugging and Troubleshooting

### Convex functions not updating
- Ensure `cd packages/backend && pnpm dev` is running
- Check the Convex dashboard at https://dashboard.convex.dev for deployment logs

### Widget not loading
- Verify `NEXT_PUBLIC_CONVEX_URL` is set in `apps/widget/.env.local`
- Verify the `organizationId` query param is a valid Clerk organization ID
- Check browser console for `Echo Widget: data-organization-id attribute is required`

### AI not responding in widget
- Check that the organization has an active subscription (`subscriptions` table in Convex dashboard)
- Verify `OPENAI_API_KEY` is set in `packages/backend/.env.local`

### Vapi integration not working
- Verify the org has a `plugins` record with `service: "vapi"` in Convex DB
- Check AWS Secrets Manager for the secret at `tenant/{orgId}/vapi`
- Verify `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` in backend env

### File upload failing
- Check subscription status is `active`
- Verify Convex file storage is enabled
- Supported MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`, `text/*`

### Auth redirect loop
- Ensure `CLERK_JWT_ISSUER_DOMAIN` matches the Clerk application's JWT template domain
- In Convex Dashboard, set `CLERK_JWT_ISSUER_DOMAIN` environment variable

---

## Development Workflow

1. Start Convex dev server (`cd packages/backend && pnpm dev`) — leave running.
2. Start apps (`pnpm dev` from root or individual `pnpm dev` in each app).
3. Make changes to Convex functions — they auto-deploy to your dev instance.
4. Make changes to frontend — hot module replacement handles it.
5. Schema changes: edit `convex/schema.ts`, Convex applies them automatically.
6. Type check before committing: `pnpm typecheck` in relevant apps.
