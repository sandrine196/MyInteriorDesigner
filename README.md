# MyInteriorDesigner

AI-powered interior design for UK homeowners: upload a photo or floor plan of a room, pick a style, and get a photorealistic render furnished with real, purchasable pieces from UK retailers — complete with individual prices and shopping links, not just an AI illustration. The same rendering pipeline also powers a **virtual staging tool for estate agents**, letting them furnish empty listing photos to help buyers see a property's potential.

Live at [myinteriordesigner.co.uk](https://myinteriordesigner.co.uk).

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS — deployed on Vercel |
| Backend | Fastify, TypeScript, Prisma ORM — deployed on Railway |
| Database | PostgreSQL |
| Image generation | Google Gemini (image generation + vision analysis) |
| Furniture removal / staging | Reve API, with Gemini image-editing as a fallback |
| Object storage | Cloudflare R2 (S3-compatible) |
| Email | Resend |
| Bot protection | Cloudflare Turnstile, honeypot fields, heuristic checks |
| Affiliate product feed | CJ Affiliate API (Raft Furniture) |

## How it works

1. **Upload a floor plan or room photo.** Users can enter room dimensions manually or upload a floor plan image for the app to read automatically.
2. **Two-step floor plan analysis.** Rather than handing a floor plan straight to the image model, it goes through a dedicated analysis pass first:
   - *Step A* asks a vision model to describe the room in rich, spatial prose — wall positions, door and window placement, fixed features like fireplaces or chimney breasts, and where natural light enters.
   - *Step B* structures that into a room shape, dimensions, and a recommended camera position.

   Both outputs are injected into the final render prompt alongside the floor plan image itself, rather than replacing it — giving the image model spatial grounding it can't reliably infer from a floor plan sketch alone. This two-pass approach measurably reduced spatial errors (windows/doors placed on the wrong wall, impossible room shapes) compared to a single-shot prompt.
3. **Pick a style and furniture.** Products are auto-matched from the retailer catalogue by room type, style, and budget, or chosen manually. Each selected product's photo is attached to the render request as a visual reference — the model is instructed to reproduce the actual piece, not invent something similar, so the furniture in the render matches what's actually being sold.
4. **Generate.** The room render, furniture matching, and floor plan grounding are combined into a single prompt sent to Gemini. Safety-filter blocks and transient provider failures are handled with automatic fallbacks and retries rather than failing the whole request.
5. **Shop the look.** Every piece of furniture in the render links to the real retailer product page, with live pricing.

## Notable engineering decisions

- **Provider-agnostic storage layer** — swapping between local disk, Cloudflare R2, or any S3-compatible backend (for EU/US data residency) is a single environment variable, no code changes.
- **Multi-provider AI fallback chain** — Reve failures fall back to Gemini image editing; a blocked product reference photo triggers a retry without that photo rather than failing the whole render; transient provider errors get one automatic retry before surfacing to the user.
- **User-facing error sanitisation** — internal errors (provider outages, safety-filter blocks) are mapped to plain-language messages before reaching the UI, while the raw diagnostic detail is still logged for debugging.
- **GDPR-conscious by default** — full data export and account deletion endpoints, configurable data retention via `STRICT_GDPR`, and a storage layer designed to support EU-region deployment.

## Project background

Solo-built over roughly three months (May–August 2026) as a personal project, and kept live as a working portfolio piece rather than a static demo. It began life as a native iOS prototype (still visible in `ios/` for the curious) before pivoting to a web-first architecture for faster iteration.

## Getting started locally

```bash
# Backend
cd backend
cp .env.example .env          # fill in your own API keys — see comments in the file
npm install
npx prisma db push            # creates a local SQLite dev database
npm run db:seed               # seeds sample products + an admin account
npm run dev                   # → http://localhost:3000

# Frontend (new terminal)
cd web
cp .env.example .env.local    # set NEXT_PUBLIC_API_URL=http://localhost:3000
npm install
npm run dev                   # → http://localhost:3001
```

Renders work without any AI keys configured (a placeholder image is returned), so you can explore the full flow before wiring up real credentials. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full environment variable reference and multi-region deployment notes.

## Repository layout

```
backend/   Fastify API — auth, rendering pipeline, admin dashboard, affiliate feed import
web/       Next.js frontend — homeowner app, estate agent tools, admin dashboard
ios/       Early native prototype, superseded by the web app
```
