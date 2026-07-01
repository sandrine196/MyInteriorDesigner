import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { storage } from "../services/storage.service.js";
import { clearFurnishedRoom, virtualStageRoom } from "../lib/gemini.js";
import { track } from "../lib/analytics.js";
import { config } from "../config/index.js";

const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const COOKIE_NAME = "redesign_session";
const MAX_FULL_REDESIGNS = 1;
const MAX_RESTAGES = 2;
const RESET_AFTER_MS = 24 * 60 * 60 * 1000; // 24h rolling window

const STYLE_BRIEFS: Record<string, string> = {
  scandinavian: "Stage this room with Scandinavian minimalist furniture. Pale woods, clean lines, natural textures, linen fabrics, neutral tones with muted greens. Add a simple plant. Bright, airy and calm.",
  modern:       "Stage this room with clean contemporary modern furniture. Neutral palette of white, grey and charcoal. Sleek lines, statement pendant lighting, minimal accessories. Sophisticated and uncluttered.",
  traditional:  "Stage this room with classic traditional British furniture. Rich warm tones, upholstered sofas, dark wooden pieces, ornate detailing. Framed artwork, table lamps, fresh flowers. Elegant and timeless.",
  industrial:   "Stage this room with industrial-style furniture. Exposed metal frames, reclaimed wood, leather and concrete tones. Factory-style lighting, raw textures, urban and bold.",
  coastal:      "Stage this room with coastal beach-house style furniture. Soft blues, whites and sandy neutrals. Natural rattan, jute and linen textures. Driftwood accents, coastal artwork. Light and breezy.",
  mid_century:  "Stage this room with mid-century modern furniture. Organic shapes, tapered legs, teak and walnut wood tones. Bold accent colours, geometric patterns. Statement armchair and retro lighting. Stylish and characterful.",
};

function getIp(request: FastifyRequest): string {
  return (
    (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? request.socket?.remoteAddress
    ?? "unknown"
  );
}

async function getOrCreateSession(sessionId: string, ipAddress: string) {
  const now = new Date();

  let session = await prisma.redesignSession.findUnique({ where: { sessionId } });

  if (!session) {
    return prisma.redesignSession.create({
      data: { sessionId, ipAddress, lastResetAt: now },
    });
  }

  // Reset counters if more than 24h since last reset
  if (now.getTime() - session.lastResetAt.getTime() > RESET_AFTER_MS) {
    return prisma.redesignSession.update({
      where: { sessionId },
      data: { fullRedesignsToday: 0, restagesUsed: 0, lastResetAt: now },
    });
  }

  return session;
}

function setCookie(reply: FastifyReply, sessionId: string) {
  reply.setCookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24, // 24h in seconds
    sameSite: "none",
    secure: true,
  });
}

export async function redesignRoutes(app: FastifyInstance) {

  // ── POST /redesign ─────────────────────────────────────────────────────────
  // Full pipeline: clear furniture + stage in chosen style.
  app.post("/redesign", async (request, reply) => {
    const existingSessionId = request.cookies?.[COOKIE_NAME];
    const sessionId = existingSessionId || randomUUID();
    const ipAddress = getIp(request);

    const session = await getOrCreateSession(sessionId, ipAddress);
    setCookie(reply, sessionId);

    if (session.fullRedesignsToday >= MAX_FULL_REDESIGNS) {
      track("redesign_limit_hit", null, { sessionId, ipAddress });
      return reply.status(429).send({
        error: "limit_reached",
        message: "Free redesign used today",
      });
    }

    // Parse multipart — photo + style
    let photoBuffer: Buffer | null = null;
    let photoMimeType = "image/jpeg";
    let style = "";

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "photo") {
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of part.file) {
          total += chunk.length;
          if (total > PHOTO_MAX_BYTES) {
            return reply.status(413).send({ error: "Photo must be under 10 MB" });
          }
          chunks.push(chunk);
        }
        photoBuffer = Buffer.concat(chunks);
        photoMimeType = part.mimetype;
      } else if (part.type === "field" && part.fieldname === "style") {
        style = (part.value as string).trim();
      }
    }

    if (!photoBuffer) return reply.status(400).send({ error: "Photo required" });
    if (!photoMimeType.startsWith("image/")) return reply.status(400).send({ error: "File must be an image" });
    if (!style || !STYLE_BRIEFS[style]) {
      return reply.status(400).send({ error: `Invalid style. Must be one of: ${Object.keys(STYLE_BRIEFS).join(", ")}` });
    }

    track("redesign_started", null, { sessionId, style });

    const brief      = STYLE_BRIEFS[style];
    const photoData  = photoBuffer.toString("base64");
    const uuid       = randomUUID();
    const prefix     = `redesigns/${sessionId}`;
    const geminiCfg  = { apiKey: config.ai.apiKey, model: config.ai.model, region: config.ai.region, reveApiKey: config.ai.reveApiKey };

    // The original photo is NOT stored — the browser already has it for the
    // before/after slider, so persisting it would be pure storage waste.

    // Step 1: Clear furniture. The cleared room is kept (needed for restage
    // within the 24h session); expired session files are removed by the daily
    // cleanup job.
    const cleared = await clearFurnishedRoom({ reveApiKey: config.ai.reveApiKey }, { photoData, photoMimeType });
    const emptyKey = `${prefix}/${uuid}-empty.jpg`;
    await storage.upload(emptyKey, cleared.buffer, "image/jpeg");
    const emptyRoomUrl = storage.getUrl(emptyKey);

    // Step 2: Stage
    const staged = await virtualStageRoom(geminiCfg, {
      photoData:     cleared.buffer.toString("base64"),
      photoMimeType: "image/jpeg",
      brief,
    });
    const stagedKey = `${prefix}/${uuid}-staged.jpg`;
    await storage.upload(stagedKey, staged.buffer, "image/jpeg");
    const stagedImageUrl = storage.getUrl(stagedKey);

    // Save empty room URL for cheap restage later, increment counter
    await prisma.redesignSession.update({
      where: { sessionId },
      data: { fullRedesignsToday: { increment: 1 }, emptyRoomUrl },
    });

    track("redesign_completed", null, { sessionId, style });

    return reply.send({
      success: true,
      stagedImageUrl,
      emptyRoomUrl,
    });
  });

  // ── POST /redesign/track-signup ───────────────────────────────────────────
  // Fire-and-forget event when user clicks the signup CTA from the reveal screen.
  app.post("/redesign/track-signup", async (request) => {
    const sessionId = request.cookies?.[COOKIE_NAME];
    track("redesign_signup_clicked", null, { sessionId: sessionId ?? "unknown" });
    return { ok: true };
  });

  // ── POST /redesign/restage ─────────────────────────────────────────────────
  // Re-stage using the already-cleared room stored on the session (~15s, no removal step).
  app.post("/redesign/restage", async (request, reply) => {
    const sessionId = request.cookies?.[COOKIE_NAME];
    if (!sessionId) {
      return reply.status(400).send({ error: "no_session", message: "Please upload a photo first" });
    }

    const session = await prisma.redesignSession.findUnique({ where: { sessionId } });

    if (!session?.emptyRoomUrl) {
      return reply.status(400).send({ error: "no_session", message: "Please upload a photo first" });
    }

    if (session.restagesUsed >= MAX_RESTAGES) {
      track("redesign_limit_hit", null, { sessionId, step: "restage" });
      return reply.status(429).send({ error: "limit_reached" });
    }

    const { style } = request.body as { style?: string };
    if (!style || !STYLE_BRIEFS[style]) {
      return reply.status(400).send({ error: `Invalid style. Must be one of: ${Object.keys(STYLE_BRIEFS).join(", ")}` });
    }

    track("redesign_try_another_style", null, { sessionId, style });

    // Fetch cleared room from R2
    const imgRes = await fetch(session.emptyRoomUrl, { signal: AbortSignal.timeout(15_000) });
    if (!imgRes.ok) return reply.status(400).send({ error: "Could not fetch cleared room image" });
    const clearedBuffer = Buffer.from(await imgRes.arrayBuffer());

    const geminiCfg = { apiKey: config.ai.apiKey, model: config.ai.model, region: config.ai.region, reveApiKey: config.ai.reveApiKey };
    const staged = await virtualStageRoom(geminiCfg, {
      photoData:     clearedBuffer.toString("base64"),
      // Older sessions may still hold PNG cleared images
      photoMimeType: session.emptyRoomUrl.endsWith(".png") ? "image/png" : "image/jpeg",
      brief:         STYLE_BRIEFS[style],
    });

    const stagedKey = `redesigns/${sessionId}/${randomUUID()}-staged.jpg`;
    await storage.upload(stagedKey, staged.buffer, "image/jpeg");
    const stagedImageUrl = storage.getUrl(stagedKey);

    const updated = await prisma.redesignSession.update({
      where: { sessionId },
      data: { restagesUsed: { increment: 1 } },
    });

    setCookie(reply, sessionId);
    return reply.send({
      success: true,
      stagedImageUrl,
      restagesRemaining: Math.max(0, MAX_RESTAGES - updated.restagesUsed),
    });
  });
}
