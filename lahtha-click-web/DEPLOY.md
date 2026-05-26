# Deployment to Vercel

The Next.js app lives in this subfolder (`lahtha-click-web/`), not at the repo root.
Configure Vercel's **Root Directory** setting accordingly.

## Option A: Vercel Dashboard (Easiest, No CLI)

1. Go to https://vercel.com/new
2. Click **"Import Git Repository"**
3. Select `ahmedfidi-cmyk/tims-backend`
4. **Important**: Set these:
   - **Root Directory**: `lahtha-click-web`
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npm run build` (default)
   - **Install Command**: `npm install` (default)
5. Click **Deploy**

Vercel will:
- Build the app
- Give you a URL like `tims-backend-XXX.vercel.app`
- Auto-redeploy on every push to `claude/lahtha-click-architecture-Fo4Mr`

## Option B: Vercel CLI

```bash
cd lahtha-click-web
npm i -g vercel
vercel login              # one-time browser auth
vercel                    # follow prompts
vercel --prod             # production deploy
```

## Environment Variables (Phase 2 - When Backend Is Live)

In Vercel dashboard → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_USE_REAL_API=true
NEXT_PUBLIC_API_BASE=https://api.lahthaclick.sa
NEXT_PUBLIC_COMMISSION_RATE_BPS=500
```

For Phase 1 (mocks), no env vars needed — defaults work.

## Custom Domain

After deploy:
1. Vercel dashboard → Domains
2. Add `lahthaclick.com` or your domain
3. Update DNS records as instructed
4. SSL auto-provisioned by Vercel
