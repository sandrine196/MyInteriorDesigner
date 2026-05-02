# Deployment Guide

## Environment Variables

### Required (app will not start without these)

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite path or Postgres DSN (e.g. `file:./dev.db`) |
| `JWT_SECRET` | ≥ 16 character secret for signing tokens |
| `FRONTEND_URL` | Frontend origin for CORS (e.g. `https://myinteriordesigner.co.uk`) |

### AI / Rendering

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | Google Gemini API key (omit to use placeholder images) |
| `GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` | Model name |
| `AI_PROVIDER` | `gemini` | `gemini` \| `stability` \| `mock` |
| `AI_REGION` | `global` | `global` \| `EU` — routes to EU endpoint when available |
| `USE_MOCK_RENDER` | `false` | `true` returns placeholder images without calling the API |

### Storage

| Variable | Default | Description |
|---|---|---|
| `STORAGE_PROVIDER` | `local` | `local` \| `r2` \| `s3` \| `scaleway` |
| `STORAGE_REGION` | `WEUR` | Storage region hint (e.g. `WEUR`, `US-EAST`) |
| `STORAGE_PUBLIC_URL` | — | Base CDN URL for uploaded files |
| `R2_ENDPOINT` | — | Cloudflare R2 endpoint |
| `R2_BUCKET_NAME` | — | R2 bucket name |
| `R2_ACCESS_KEY_ID` | — | R2 access key |
| `R2_SECRET_ACCESS_KEY` | — | R2 secret key |
| `S3_ENDPOINT` | — | S3-compatible endpoint (also used for Scaleway) |
| `S3_BUCKET_NAME` | — | S3 bucket name |
| `S3_ACCESS_KEY_ID` | — | S3 access key |
| `S3_SECRET_ACCESS_KEY` | — | S3 secret key |

### Regional / Compliance

| Variable | Default | Description |
|---|---|---|
| `DEPLOYMENT_REGION` | `UK` | `UK` \| `US` \| `EU` — shown in health check and logs |
| `STRICT_GDPR` | `false` | `true` enables EU-specific data handling |
| `ENABLE_ANALYTICS` | `true` | `false` disables event tracking |

### Rate Limits

| Variable | Default | Description |
|---|---|---|
| `FREE_RENDERS_PER_MONTH` | `5` | Monthly render allowance for free users |
| `PRO_RENDERS_PER_DAY` | `100` | Daily cap for pro users |
| `MAX_RENDERS_PER_HOUR` | `20` | Per-user hourly cap |
| `MAX_PROJECTS_FREE` | `10` | Project limit for free tier |
| `MAX_PROJECTS_PRO` | `100` | Project limit for pro tier |
| `RENDER_COOLDOWN_SECONDS` | `30` | Minimum seconds between renders on the same project |
| `MAX_CONCURRENT_RENDERS` | `3` | Global in-flight render cap |

### Email / Alerts

| Variable | Default | Description |
|---|---|---|
| `ALERT_EMAIL` | — | Address for abuse alerts (optional) |
| `EMAIL_FROM` | `hello@myinteriordesigner.co.uk` | Sender address |

---

## Deployments

### Current (UK, local storage)

```bash
DEPLOYMENT_REGION=UK
STORAGE_PROVIDER=local
AI_PROVIDER=gemini
```

### EU Deployment (when ready)

```bash
DEPLOYMENT_REGION=EU
STORAGE_PROVIDER=scaleway        # EU data residency
STORAGE_REGION=fr-par
S3_ENDPOINT=https://s3.fr-par.scw.cloud
S3_BUCKET_NAME=myid-eu
STORAGE_PUBLIC_URL=https://myid-eu.s3.fr-par.scw.cloud
AI_REGION=EU                     # Routes to EU Gemini endpoint
STRICT_GDPR=true                 # Enables shorter data retention + GDPR features
DATABASE_URL=postgresql://...    # Postgres in EU region
DATABASE_READ_URL=postgresql://... # Optional read replica
```

### US Deployment (future)

```bash
DEPLOYMENT_REGION=US
STORAGE_PROVIDER=s3
STORAGE_REGION=US-EAST
S3_BUCKET_NAME=myid-us
STORAGE_PUBLIC_URL=https://cdn-us.myinteriordesigner.co.uk
```

---

## Health Check

`GET /health` returns deployment metadata:

```json
{
  "status": "ok",
  "timestamp": "2026-04-30T12:00:00.000Z",
  "region": "UK",
  "version": "1.0.0",
  "env": "production",
  "services": {
    "database": "ok",
    "storage": "local",
    "ai": "gemini"
  }
}
```

---

## GDPR Endpoints

| Endpoint | Description |
|---|---|
| `GET /me/export` | Download all user data as JSON |
| `DELETE /me/delete-account` | Permanently delete account + all data |

---

## Upgrading Storage Provider

Swapping from local disk to R2 is a one-step change — no code edits required:

1. Create an R2 bucket and API token in the Cloudflare dashboard
2. Set in production env:
   ```
   STORAGE_PROVIDER=r2
   R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
   R2_BUCKET_NAME=myid-prod
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   STORAGE_PUBLIC_URL=https://cdn.myinteriordesigner.co.uk
   ```
3. Uncomment the `S3Client` code in `src/services/storage.service.ts` (marked with TODO)
4. Run `npm install @aws-sdk/client-s3`
5. Migrate existing files: `rclone sync uploads/ r2-remote:myid-prod/`

The `getUrl()` method automatically returns CDN URLs once `STORAGE_PUBLIC_URL` is set.
