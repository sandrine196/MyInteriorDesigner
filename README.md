# RoomVision (MVP)

Freemium iOS app scaffold for UK room visualization: upload a floor plan, pick real retailer products (seed data), and request a **Gemini / Nano Banana** image render from the API.

## Layout

- `backend/` — Node.js + TypeScript API (Fastify, Prisma, SQLite, JWT, Gemini image generation).
- `ios/` — SwiftUI client + `project.yml` for [XcodeGen](https://github.com/yonaskolb/XcodeGen).

## Backend

Requirements: Node.js 20+, npm.

```bash
cd backend
cp .env.example .env
# Add GEMINI_API_KEY from https://aistudio.google.com/ when you want real renders
npm install
npx prisma db push
npm run db:seed
npm run dev
```

API defaults to `http://0.0.0.0:3000`. Health check: `GET /health`.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file (default in `.env.example`) |
| `JWT_SECRET` | At least 16 characters |
| `GEMINI_API_KEY` | Optional; if omitted, renders save a tiny placeholder PNG and return a note |
| `GEMINI_IMAGE_MODEL` | Defaults to `gemini-2.5-flash-image` (Nano Banana family) |
| `FREE_RENDERS_PER_MONTH` | Freemium cap for `tier=free` users (default 5) |

### Main endpoints

- `POST /auth/register`, `POST /auth/login`
- `GET /products` (auth) — seeded IKEA / Wayfair / John Lewis style rows
- `POST /projects`, `GET /projects`, `POST /projects/:id/floor-plan` (multipart `file`), `POST /projects/:id/renders`
- `GET /me/usage` — monthly render usage for freemium messaging

## iOS

1. Install XcodeGen (`brew install xcodegen`).
2. Generate the Xcode project:

```bash
cd ios
xcodegen generate
open RoomVision.xcodeproj
```

3. **Simulator:** the app points at `http://127.0.0.1:3000` (`Config.swift`). Run the backend locally.
4. **Physical iPhone:** set `Config.apiBaseURL` to your Mac’s LAN IP, e.g. `http://192.168.1.10:3000`, same Wi‑Fi as the phone.
5. **App icon:** add a 1024×1024 icon in `Assets.xcassets` if Xcode warns (MVP placeholder is empty).

Sign in with a new account, create a project, upload a floor plan image, select products, then **Generate render**.

## Legal / product notes

- Seeded product URLs and affiliate links are **placeholders** until you connect real affiliate feeds and compliance-approved tracking links.
- AI images may include SynthID watermarking per Google’s policies; keep in-app copy honest about visualization vs. measured accuracy.

## Next steps (not in this scaffold)

- StoreKit subscriptions for Pro tier, Awin/CJ feed importers, production object storage for uploads, and App Store privacy labels.
