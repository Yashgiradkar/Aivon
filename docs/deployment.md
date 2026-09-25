# Deployment Guide

> See also: [development.md](./development.md) · [architecture.md](./architecture.md)

---

## Environments

| Environment | Description | Configuration |
|-------------|-------------|---------------|
| **Development** | Local dev with Convex dev instance | `.env.local` files, Convex `dev:` deployment |
| **Production** | Deployed to Vercel + Convex prod | Production env vars in Vercel and Convex dashboards |

The Convex deployment slug from `packages/backend/.env.local` (`CONVEX_DEPLOYMENT`) identifies which Convex instance is in use.

---

## Application Deployments

### `apps/web` — Operator Dashboard

- **Platform**: Vercel (inferred from Sentry config: `sentry.io` org `aivon-2t`, project `aivon-errors`)
- **Framework**: Next.js 15 with Sentry instrumentation
- **Build command**: `next build` (or `pnpm build` from root via Turbo)

### `apps/widget` — Chat Widget

- **Platform**: Vercel (URL referenced in `apps/web/modules/integrations/constants.ts` as `https://aivon-chat.vercel.app`)
- **Framework**: Next.js 15

### `apps/embed` — Embeddable Script

- **Platform**: Vercel (hosted at `https://aivon-chat.vercel.app/widget.js`)
- **Framework**: Vite → static JS bundle

### `packages/backend` — Convex

- **Platform**: Convex Cloud
- **Deployment**: Automatic via `npx convex deploy` or Convex GitHub integration
- **Project**: `aivon` (team: `yash-giradkar`, deployment: `brainy-peccary-603`)

---

## Build Process

```bash
# Build all apps
pnpm build

# The Turbo pipeline (turbo.json) runs build in dependency order:
# 1. packages/ui → packages/backend
# 2. apps/web, apps/widget, apps/embed (parallel)
```

Turbo caches build outputs in `.turbo/`. Build outputs:
- `apps/web/.next/` — Next.js server build
- `apps/widget/.next/` — Next.js server build
- `apps/embed/dist/` — Vite static bundle (the `widget.js` file)

---

## Required Environment Variables

### `packages/backend` (Convex dashboard environment variables)

Set these in the Convex Dashboard → Project Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk application issuer domain for JWT verification |
| `CLERK_SECRET_KEY` | Clerk secret key (for webhook processing + org management) |
| `CLERK_WEBHOOK_SECRET` | Svix webhook signing secret |
| `OPENAI_API_KEY` | OpenAI API key (used by agent, RAG, and file extraction) |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Secrets Manager |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for Secrets Manager |
| `AWS_REGION` | AWS region (e.g., `us-east-1`) |

### `apps/web` (Vercel environment variables)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Public Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGNIN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGNUP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGNIN_FALLBACK_REDIRECT_URL` | `/` |
| `NEXT_PUBLIC_CLERK_SIGNUP_FALLBACK_REDIRECT_URL` | `/` |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload |

### `apps/widget` (Vercel environment variables)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Public Convex deployment URL |

### `apps/embed` (Vite build-time)

| Variable | Description |
|----------|-------------|
| `VITE_WIDGET_URL` | Widget app URL (e.g., `https://aivon-chat.vercel.app`) |

If `VITE_WIDGET_URL` is not set, defaults to `http://localhost:3001` (from `apps/embed/config.ts`).

---

## Convex Deployment

### First-time setup

```bash
cd packages/backend
npx convex dev --until-success   # or: pnpm setup
```

This creates a Convex deployment, sets `CONVEX_DEPLOYMENT` in `.env.local`, and deploys functions.

### Deploy to production

```bash
cd packages/backend
npx convex deploy
```

Or connect the GitHub repository to the Convex dashboard for automatic deployment on push.

### Schema changes

Convex applies schema changes automatically on `convex dev` or `convex deploy`. No migration files are needed for additive changes (new fields, new tables). For field removal:
1. Remove field usage from all query/mutation handlers
2. Deploy the updated functions
3. Remove the field from `schema.ts` and deploy again

---

## Clerk Configuration (Required for Production)

1. Create a Clerk application at https://clerk.com
2. Create a **JWT template** named `convex` — this generates the `CLERK_JWT_ISSUER_DOMAIN`
3. Set up **organization** support in Clerk application settings
4. Configure **Webhooks** pointing to `{CONVEX_SITE_URL}/clerk-webhook`:
   - Event: `subscription.updated`
   - Copy the signing secret to `CLERK_WEBHOOK_SECRET`
5. Optionally configure Clerk billing for subscription management

---

## AWS Secrets Manager Setup

The Vapi plugin stores credentials in AWS Secrets Manager:

1. Create an IAM user with `secretsmanager:CreateSecret`, `secretsmanager:PutSecretValue`, and `secretsmanager:GetSecretValue` permissions
2. Secrets are auto-created in the pattern `tenant/{organizationId}/vapi`
3. The IAM credentials go into Convex environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)

---

## Health Checks

There are no dedicated health check endpoints. Availability can be inferred from:
- **Convex**: Convex dashboard shows deployment health and function error rates
- **Next.js apps**: Vercel provides deployment health monitoring
- **Sentry**: Error rates visible in Sentry dashboard (org: `aivon-2t`, project: `aivon-errors`)

---

## Logging / Monitoring

| Service | What's Logged |
|---------|--------------|
| **Convex dashboard** | Function logs, error traces, DB query performance |
| **Sentry** | Runtime errors from `apps/web` (client + server), source-mapped stack traces |
| **Vercel** | Build logs, function execution logs |

The Sentry tunnel route `/monitoring` in `apps/web/next.config.mjs` proxies browser error reports to bypass ad-blockers.

---

## Rollback Considerations

### Convex
- Convex supports redeployment of a previous function version via the Convex CLI or dashboard
- Database schema rollback: not directly supported — design additive-first schemas
- If a schema migration fails, the previous functions continue operating on the old schema

### Next.js on Vercel
- Vercel supports instant rollback to any previous deployment from the dashboard
- `NEXT_PUBLIC_CONVEX_URL` must remain compatible across frontend and backend rollbacks

---

## Production Troubleshooting

### AI agent not responding
1. Check Convex function logs for `public.messages.create` — look for subscription status failures
2. Verify `OPENAI_API_KEY` is valid and has sufficient quota
3. Check if conversation status is `escalated` or `resolved` (agent won't trigger)

### Webhook events not processing
1. Verify `CLERK_WEBHOOK_SECRET` matches the Svix signing secret in Clerk dashboard
2. Check Convex function logs for `clerk-webhook` HTTP route
3. Verify the webhook URL is `{CONVEX_SITE_URL}/clerk-webhook` (not the Convex API URL)

### Files not indexing (RAG not working)
1. Check subscription is active
2. Verify `OPENAI_API_KEY` — text extraction uses OpenAI APIs
3. Check file MIME type is supported (image/*, application/pdf, text/*)
4. Check Convex dashboard for failed actions in `private.files.addFile`

### Widget not loading on customer site
1. Verify embed script src points to correct URL
2. Check `data-organization-id` is a valid Clerk org ID (starts with `org_`)
3. Check browser console for CORS errors or iframe load failures
4. Verify `NEXT_PUBLIC_CONVEX_URL` is set correctly in widget deployment

### Vapi voice not working
1. Check if org has Vapi plugin connected (dashboard → Voice Assistant)
2. Verify Vapi credentials in AWS Secrets Manager
3. Check browser has microphone permissions (iframe requires `allow="microphone"`)
