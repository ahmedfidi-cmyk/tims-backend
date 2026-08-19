# Publishing LAHTHA & CLICK — recommended path

Fastest route to a live, public URL with the least DevOps work. Three managed services,
all with generous free tiers, all deployed from this same GitHub repo.

| Piece | Where | Why |
|---|---|---|
| **`lahtha-click-web`** (Next.js) | **Vercel** | Zero-config for Next.js; git-push-to-deploy; free tier covers launch traffic |
| **`lahtha-click`** (API) | **Railway** or **Render** | Auto-detects Node, or use the included `Dockerfile`; env-var UI; free/cheap tier |
| **Database** | **MongoDB Atlas** (free M0 cluster) | Managed — backups/scaling/security handled for you |

No code changes are needed to deploy — every environment-specific value (`BACKEND_URL`,
`MONGO_URI`, session pepper, etc.) is already read from environment variables
(`lahtha-click/.env.example`, `lahtha-click-web/.env.example`).

**Why no CORS setup:** the browser never talks to the backend directly. `lahtha-click-web`'s
Next.js Route Handlers (`app/api/**/route.ts`) proxy every request server-side, forwarding
the session cookie. That's a server-to-server `fetch`, which CORS doesn't apply to — so the
backend and frontend can live on completely different domains with zero extra config.

## Steps

### 1. Database — MongoDB Atlas
1. Create a free account → free **M0** cluster (pick a region near your users, e.g. `me-central1`/Bahrain if available, else closest).
2. Database Access → create a user with a strong password.
3. Network Access → allow access from anywhere (`0.0.0.0/0`) — simplest for a PaaS backend with a dynamic egress IP; tighten later with a static-IP add-on if you want to restrict it.
4. Copy the connection string (`mongodb+srv://...`) → this is `MONGO_URI`.

### 2. Backend — Railway (or Render)
1. New Project → Deploy from GitHub repo → select this repo, root directory `lahtha-click`.
2. Railway auto-detects the `Dockerfile` in `lahtha-click/` and builds from it. (On Render: New → Web Service → same repo/root → it also auto-detects the Dockerfile.)
3. Set environment variables (see `lahtha-click/.env.example` for the full list; minimum to go live):
   - `NODE_ENV=production`
   - `MONGO_URI` (from step 1), `MONGO_DB_NAME=lahtha_click`
   - `IAM_OTP_PEPPER` — **generate a real secret**, e.g. `openssl rand -hex 32`. The default in `.env.example` is intentionally insecure and must be overridden.
   - `PAYMENT_PROVIDER=stub` for a soft launch (dev auto-capture — **never leave this on real production traffic once you're taking real payments**), or configure `MOYASAR_API_KEY` + `MOYASAR_WEBHOOK_SECRET` once you have a Moyasar merchant account (see ADR-0010).
   - Leave `STORAGE_DRIVER` unset until you have an S3 bucket — the storage seam **fails closed** in production without it (device-document upload will 503 until configured; everything else works).
4. Deploy. The platform injects `PORT`; the app already reads it via `src/config`.
5. Point the platform's health check at `GET /health` (liveness) — `GET /ready` also exists and additionally checks the Mongo connection, if the host supports a separate readiness check.
6. Note the public URL Railway/Render gives you (e.g. `https://lahtha-click-production.up.railway.app`) — this is `BACKEND_URL` for the next step.
7. One-time only, from your own machine (not the container): run `MONGO_URI=<atlas-uri> npm run migrate:up` from `lahtha-click/`, then `npm run seed:admin` to create the first admin account.

### 3. Web — Vercel
1. New Project → import this repo → set the root directory to `lahtha-click-web`.
2. Environment variable: `BACKEND_URL=<the Railway/Render URL from step 2.6>`.
3. Deploy. Vercel builds with `next build` and serves it — no other config needed.
4. Attach your custom domain in Vercel's dashboard once you have one (Vercel issues a free `*.vercel.app` URL immediately, so you can publish before a domain is ready).

## Before real customers hit it

- [ ] `IAM_OTP_PEPPER` is a real generated secret, not the `.env.example` default.
- [ ] `PAYMENT_PROVIDER` is **not** `stub` once you're accepting real orders (stub auto-captures every payment — dev/demo only).
- [ ] Admin account seeded (`npm run seed:admin`), and you've logged in once to confirm it works.
- [ ] `MONGO_URI` points at Atlas, not a local/dev database.

## What's deliberately deferred

Real Moyasar credentials, S3 bucket for document storage, and a custom domain are the pieces
that need real-world setup (a merchant account, an AWS account, DNS) — nothing here blocks
going live with a soft launch (stub payments, doc uploads showing "not configured" until an
S3 bucket is added) and swapping those in later with zero code changes.
