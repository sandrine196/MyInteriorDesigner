# MyInteriorDesigner — Deployment Workflow

> **Reference guide for all deployments.** Solo developer workflow for a Vercel (frontend) + Railway (backend) stack.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Local Development Setup](#2-local-development-setup)
3. [Git Branch Strategy](#3-git-branch-strategy)
4. [Environment Variables](#4-environment-variables)
5. [Database: SQLite → PostgreSQL](#5-database-sqlite--postgresql)
6. [Common Deployment Workflows](#6-common-deployment-workflows)
7. [Pre-Deployment Checklist](#7-pre-deployment-checklist)
8. [Post-Deployment Verification](#8-post-deployment-verification)
9. [Rollback Procedures](#9-rollback-procedures)
10. [Troubleshooting](#10-troubleshooting)
11. [Security Checklist](#11-security-checklist)
12. [Emergency Procedures](#12-emergency-procedures)

---

## 1. Architecture Overview

```
Users
  │
  ▼
myinteriordesigner.co.uk          ← Vercel (Next.js frontend)
  │  NEXT_PUBLIC_API_URL
  ▼
myinteriordesigner-production.up.railway.app  ← Railway (Fastify backend)
  ├── PostgreSQL (Railway add-on)
  ├── Cloudflare R2 (renders + floor plans)
  ├── Gemini API (image generation)
  ├── OpenAI GPT-4o Vision (floor plan analysis)
  └── Resend (transactional email)
```

> **Note:** the backend is served directly from Railway's generated `*.up.railway.app`
> domain. A custom `api.myinteriordesigner.co.uk` domain was never actually
> configured in Railway — don't chase it if you see it mentioned elsewhere (old
> notes, tickets, etc.); it doesn't exist.

| Environment | Frontend | Backend | Database |
|---|---|---|---|
| **Local dev** | `localhost:3001` | `localhost:3000` | SQLite (`dev.db`) |
| **Production** | `myinteriordesigner.co.uk` | `myinteriordesigner-production.up.railway.app` | PostgreSQL (Railway) |

**Build commands:**

| | Command |
|---|---|
| Backend build | `npm run build` → `tsc` → `dist/` |
| Backend start | `npm run start` → `node --max-old-space-size=512 dist/index.js` |
| Frontend build | `next build` |
| Frontend start | `next start` |

---

## 2. Local Development Setup

### Prerequisites

- Node.js 20+
- npm
- Git

### First-time setup

```bash
# Clone the repo
git clone https://github.com/sandrine196/MyInteriorDesigner.git
cd MyInteriorDesigner

# Backend
cd backend
npm install
cp .env.example .env          # then fill in your values
npx prisma db push            # creates dev.db with the schema
npm run db:seed               # seeds products + admin user
npm run dev                   # starts on http://localhost:3000

# Frontend (new terminal)
cd ../web
npm install
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL=http://localhost:3000
npm run dev                   # starts on http://localhost:3001
```

### Why SQLite locally?

- Zero setup — no database server to run
- Works offline
- `prisma db push` applies schema changes instantly (no migration files needed)
- Prisma's query API is identical for SQLite and PostgreSQL
- Switch between them by changing one env var

### Local `.env` minimum for image generation

```bash
DATABASE_URL=file:./dev.db
JWT_SECRET=any-long-random-string-for-local-dev
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash-image
OPENAI_API_KEY=your-key
AI_PROVIDER=gemini
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=myinteriordesigner-storage
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_PUBLIC_URL=https://pub-xxxx.r2.dev
RESEND_API_KEY=re_...
EMAIL_PROVIDER=resend
EMAIL_FROM=hello@myinteriordesigner.co.uk
FRONTEND_URL=http://localhost:3001
USE_MOCK_RENDER=false
```

---

## 3. Git Branch Strategy

### Branch structure

```
main
  └── feature/description    ← new features
  └── fix/description        ← bug fixes
  └── hotfix/description     ← urgent production fixes
```

### Rules

- `main` is always deployable — it auto-deploys to Vercel and Railway on every push
- **Never push directly to `main`** — always use a branch + PR
- Vercel creates a **preview URL** for every branch push — use this to test before merging
- Hotfixes follow the same PR process but merge immediately without waiting

### Standard feature workflow

```bash
# 1. Start from a clean main
git checkout main
git pull origin main

# 2. Create a feature branch
git checkout -b feature/improve-floor-plan-analysis

# 3. Make changes, commit often
git add backend/src/services/ai.service.ts
git commit -m "Improve GPT-4o Vision spatial analysis prompt"

# 4. Push to GitHub
git push -u origin feature/improve-floor-plan-analysis

# 5. Open a PR on GitHub
#    → Vercel automatically builds a preview URL
#    → Test the preview URL thoroughly

# 6. Merge the PR
#    → Railway and Vercel auto-deploy from main
```

### Hotfix workflow (production is broken)

```bash
git checkout main
git pull origin main
git checkout -b hotfix/fix-gemini-503-fallback

# Make the minimal fix
git add ...
git commit -m "Fix: fall back to mock on Gemini 503"
git push -u origin hotfix/fix-gemini-503-fallback

# Open PR, review briefly, merge immediately
# Monitor Railway logs after deploy
```

### Vercel preview URLs

Every branch push creates a unique preview URL:
`https://my-interior-designer-git-feature-improve-xxx.vercel.app`

The preview frontend talks to **production Railway** by default (uses the same `NEXT_PUBLIC_API_URL`). To test against a local or staging backend, update `NEXT_PUBLIC_API_URL` in Vercel's preview environment settings.

---

## 4. Environment Variables

### Backend — Railway Variables

Go to: Railway → your project → your service → Variables

```bash
# ── Required ───────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://...        # auto-injected by Railway PostgreSQL add-on
JWT_SECRET=<openssl rand -hex 32>
NODE_ENV=production
FRONTEND_URL=https://myinteriordesigner.co.uk

# ── AI ─────────────────────────────────────────────────────────────────────────
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-image
OPENAI_API_KEY=...

# ── Storage ─────────────────────────────────────────────────────────────────────
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=myinteriordesigner-storage
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_REGION=WEUR
STORAGE_PUBLIC_URL=https://pub-xxxx.r2.dev

# ── Email ───────────────────────────────────────────────────────────────────────
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=hello@myinteriordesigner.co.uk
ALERT_EMAIL=you@example.com

# ── Rate limits (defaults shown) ───────────────────────────────────────────────
FREE_RENDERS_PER_MONTH=5
PRO_RENDERS_PER_DAY=100
MAX_RENDERS_PER_HOUR=20
RENDER_COOLDOWN_SECONDS=30
MAX_CONCURRENT_RENDERS=3
MAX_PROJECTS_FREE=10
MAX_PROJECTS_PRO=100

# ── Flags ──────────────────────────────────────────────────────────────────────
USE_MOCK_RENDER=false
DEPLOYMENT_REGION=UK
```

### Frontend — Vercel Variables

Go to: Vercel → your project → Settings → Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://myinteriordesigner-production.up.railway.app
NEXT_PUBLIC_REGION=UK
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_COOKIE_CONSENT=false
```

### Rotating secrets safely

| Secret | Impact of rotation | Safe to rotate? |
|---|---|---|
| `JWT_SECRET` | All active user sessions invalidated (everyone logged out) | Yes, off-peak only |
| `GEMINI_API_KEY` | Renders fail until new key propagates | Yes, update Railway first |
| `R2_ACCESS_KEY_ID` | File uploads/downloads fail | Yes, update Railway first |
| `JWT_SECRET` | All active sessions invalidated | Schedule for low-traffic time |

```bash
# Generate a new JWT_SECRET
openssl rand -hex 32
```

---

## 5. Database: SQLite → PostgreSQL

### One-time production migration

**Step 1 — Add PostgreSQL to Railway:**
```
Railway project → + New → Database → Add PostgreSQL
Railway auto-injects DATABASE_URL into your service environment
```

**Step 2 — Update Prisma schema:**
```prisma
// backend/prisma/schema.prisma
datasource db {
  provider = "postgresql"   // ← change from "sqlite"
  url      = env("DATABASE_URL")
}
```

**Step 3 — Create the initial migration:**
```bash
cd backend
# Use your Railway PostgreSQL URL
DATABASE_URL="postgresql://..." npx prisma migrate dev --name init
# This creates: prisma/migrations/20260514_init/migration.sql
```

**Step 4 — Commit the migration:**
```bash
git add prisma/
git commit -m "Add initial PostgreSQL migration"
git push
# Railway will run `prisma migrate deploy` on next deploy
```

**Step 5 — Seed production data:**
```bash
# Run from your local machine against the Railway DB
DATABASE_URL="postgresql://..." npm run db:seed
```

⚠️ **Do Step 5 only once.** Re-running seed deletes all products and re-inserts them.

### Adding schema changes after launch

```bash
# 1. Modify schema.prisma
# 2. Test locally (SQLite)
npx prisma db push

# 3. Create a migration for production
npx prisma migrate dev --name add-user-preferences

# 4. Commit the migration file
git add prisma/migrations/
git commit -m "Migration: add user preferences"
git push
# Railway automatically runs: npx prisma migrate deploy
```

### Checking migration status

```bash
# Against production
DATABASE_URL="postgresql://..." npx prisma migrate status
```

---

## 6. Common Deployment Workflows

### A. Deploying a prompt change (no schema change)

```bash
git checkout -b fix/doorframe-perspective
# Edit backend/src/lib/gemini.ts
git add backend/src/lib/gemini.ts
git commit -m "Strengthen doorframe camera perspective in prompt"
git push
# Open PR → check Vercel preview → merge
# Railway redeploys automatically (~2 min)
```

### B. Deploying a new product seed

```bash
# 1. Edit backend/prisma/seed.ts
# 2. Test locally
npm run db:seed

# 3. Deploy the seed file change
git add backend/prisma/seed.ts
git commit -m "Add lighting products to seed"
git push  # → merge to main

# 4. After Railway deploys, re-seed production
DATABASE_URL="postgresql://..." npm run db:seed
```

### C. Deploying a schema change

```bash
# 1. Edit prisma/schema.prisma
# 2. Test locally
npx prisma db push

# 3. Create migration
npx prisma migrate dev --name describe-change

# 4. Commit everything
git add prisma/
git commit -m "Schema: add roomType to Project"
git push  # → merge to main
# Railway runs prisma migrate deploy automatically
```

### D. Changing an environment variable

```
Railway → Variables → edit value → Save
Railway redeploys automatically
```

> ⚠️ Changing `JWT_SECRET` logs out all users. Do it off-peak.

### E. Rolling back a bad deploy

See [Section 9 — Rollback Procedures](#9-rollback-procedures).

---

## 7. Pre-Deployment Checklist

Run through this before merging any PR to `main`:

### Code

- [ ] TypeScript compiles without errors: `cd backend && npm run build`
- [ ] No `console.log` left in production paths that would leak sensitive data
- [ ] No hardcoded API keys, URLs, or secrets in the code
- [ ] Error messages don't expose internal details (checked in `index.ts` error handler)

### Database

- [ ] If schema changed: migration file committed in `prisma/migrations/`
- [ ] Migration tested locally against a copy of the DB
- [ ] No destructive migration (DROP COLUMN, DROP TABLE) without a data backup

### Environment

- [ ] All new env vars added to Railway and Vercel
- [ ] New env vars documented in `.env.example`
- [ ] `FRONTEND_URL` in Railway matches the actual frontend domain (for CORS)

### AI / External Services

- [ ] Gemini API key is valid (test: `curl .../health`)
- [ ] `USE_MOCK_RENDER=false` in production
- [ ] R2 bucket is accessible (upload a test file if unsure)

### Frontend

- [ ] `NEXT_PUBLIC_API_URL` points to production backend, not localhost
- [ ] Vercel preview URL tested and renders load correctly
- [ ] No broken images (check `next.config.ts` `remotePatterns` includes all domains)

---

## 8. Post-Deployment Verification

Run these immediately after every deploy:

```bash
# 1. Health check — database + storage + AI provider status
curl https://myinteriordesigner-production.up.railway.app/health
# Expected:
# {"status":"ok","services":{"database":"ok","storage":"r2","ai":"gemini"}}

# 2. Auth — register a test user
curl -s -X POST https://myinteriordesigner-production.up.railway.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"deploy-test@example.com","password":"testpass123"}' | python3 -m json.tool
# Expected: {"token":"...","user":{"id":"...","email":"...","tier":"free"}}

# 3. Frontend loads
curl -I https://myinteriordesigner.co.uk
# Expected: HTTP/2 200

# 4. Check Railway logs for errors
# Railway → your service → Logs → filter last 5 minutes
```

### Smoke test a render (manual)

1. Log in at `myinteriordesigner.co.uk`
2. Create a project → upload a floor plan → set dimensions
3. Trigger a render
4. Verify the image loads from the R2 CDN URL (check browser Network tab)
5. Confirm the Railway logs show `[Gemini] Done — PNG buffer size: ...`

---

## 9. Rollback Procedures

### Frontend rollback (Vercel)

```
Vercel → your project → Deployments tab
→ Find the last working deployment
→ Click ⋮ (three dots) → "Promote to Production"
Takes ~30 seconds. No code changes needed.
```

### Backend rollback (Railway)

```
Railway → your project → your service → Deployments tab
→ Find the last working deployment
→ Click "Redeploy"
Takes ~2 minutes.
```

### Database rollback

⚠️ **There is no automatic database rollback.** Migrations only go forward.

**If a migration broke production:**

Option A — Fix forward (preferred):
```bash
# Write a new migration that undoes the damage
npx prisma migrate dev --name revert-bad-change
git add prisma/ && git commit -m "Revert: undo broken migration" && git push
```

Option B — Manual SQL (emergency only):
```bash
# Connect to Railway PostgreSQL
DATABASE_URL="postgresql://..." npx prisma db execute --file revert.sql
```

**Prevention:** Always take a database snapshot before destructive migrations:
```
Railway → PostgreSQL service → Backups → Create backup
```

---

## 10. Troubleshooting

### Backend won't start on Railway

```bash
# Check the build log first
Railway → Deployments → click failing deploy → View Logs

# Common causes:
# 1. Missing env var → env.ts throws "Invalid environment variables"
#    Fix: add the missing variable in Railway → Variables

# 2. TypeScript compile error
#    Fix: run `npm run build` locally to see the error

# 3. Database connection failed
#    Fix: verify DATABASE_URL is the Railway PostgreSQL URL, not SQLite
```

### Renders returning 500

```bash
# Check Railway logs during a render attempt
# Look for [Gemini] or [OpenAI] prefix lines

# Common causes:
# 1. GEMINI_API_KEY missing or invalid
curl https://myinteriordesigner-production.up.railway.app/health
# → ai field shows "gemini" but renders fail → key issue

# 2. USE_MOCK_RENDER=true accidentally set
# Fix: Railway → Variables → USE_MOCK_RENDER=false → Save

# 3. R2 upload failing
# Fix: verify R2_* credentials and bucket name
```

### Frontend shows blank images / broken renders

```bash
# Check browser console for blocked image errors
# Common causes:
# 1. STORAGE_PUBLIC_URL not set → imageKey stored, no public URL generated
# 2. *.r2.dev not in next.config.ts remotePatterns
# 3. Cloudflare R2 public access not enabled on the bucket
```

### CORS errors in browser console

```
Access to fetch at 'https://api...' blocked by CORS policy
```

```bash
# Fix: check FRONTEND_URL in Railway matches exactly
# (no trailing slash, correct protocol)
FRONTEND_URL=https://myinteriordesigner.co.uk   ✅
FRONTEND_URL=https://myinteriordesigner.co.uk/  ❌ (trailing slash)
FRONTEND_URL=http://myinteriordesigner.co.uk    ❌ (wrong protocol)
```

### JWT errors / users getting logged out

```bash
# "Unauthorized" on all requests after a deploy:
# Cause: JWT_SECRET was changed → all tokens invalid
# Fix: users must log in again (this is expected behaviour)

# If it happens unexpectedly, check JWT_SECRET hasn't changed in Railway
```

### Prisma migration errors on deploy

```bash
# "There are pending migrations that have not yet been applied"
# Railway logs show prisma migrate deploy failing

# Fix option 1: apply manually
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Fix option 2: check migration files are committed
git log --oneline prisma/migrations/
```

---

## 11. Security Checklist

### Before every production deploy

- [ ] No secrets in source code (`git grep -i "api_key\|secret\|password"`)
- [ ] `.env` files are in `.gitignore` and not committed
- [ ] Error handler returns generic messages for 500s in production
- [ ] Rate limiting is active (`/health` response should be fast, not 429)

### Infrastructure

- [ ] Database is not publicly reachable from the internet
- [ ] R2 bucket: public access enabled only for the `renders/` and `floor-plans/` prefixes, not the whole bucket
- [ ] JWT_SECRET is at least 32 random characters
- [ ] Admin routes (`/admin/*`) require `isAdmin=true` JWT claim

### Periodic (monthly)

- [ ] Rotate R2 access keys
- [ ] Check Railway logs for unusual traffic patterns
- [ ] Review `ALERT_EMAIL` received any suspension alerts
- [ ] Verify free-tier render limits haven't been abused

---

## 12. Emergency Procedures

### Production is completely down

```bash
# 1. Check Railway service status
Railway → your service → is it running? → check logs

# 2. Check Vercel status
Vercel → your project → is the latest deployment successful?

# 3. Quick health check
curl -I https://myinteriordesigner-production.up.railway.app/health

# 4. If Railway service is crashed: redeploy the last working version
Railway → Deployments → previous deploy → Redeploy

# 5. If database is unreachable:
Railway → PostgreSQL service → is it running?
# Restart it from the Railway dashboard if needed
```

### Accidental data deletion

```bash
# Restore from Railway automatic backup
Railway → PostgreSQL service → Backups
# Select the most recent backup before the incident
# Click Restore → creates a new DB instance
# Update DATABASE_URL in your service to point to the restored instance
```

### API key compromised

```bash
# Gemini or OpenAI key leaked:
# 1. Revoke the key immediately in the provider dashboard
# 2. Generate a new key
# 3. Update Railway → Variables → GEMINI_API_KEY / OPENAI_API_KEY
# Railway redeploys automatically

# R2 key leaked:
# 1. Cloudflare → R2 → Manage API Tokens → Revoke
# 2. Create new token with same bucket permissions
# 3. Update R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in Railway
```

### Runaway render usage (abuse detected)

```bash
# 1. Suspend the abusive user via admin panel or directly:
DATABASE_URL="postgresql://..." npx prisma studio
# Find user → set suspended=true

# 2. Temporarily lower rate limits in Railway:
MAX_RENDERS_PER_HOUR=5
MAX_CONCURRENT_RENDERS=1

# 3. Check ALERT_EMAIL — the auto-suspend system may have already fired
```

---

*Last updated: May 2026*
