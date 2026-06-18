import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { storage } from "../services/storage.service.js";
import { clearFurnishedRoom, virtualStageRoom } from "../lib/gemini.js";
import { config } from "../config/index.js";

const PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const STYLE_BRIEFS: Record<string, string> = {
  scandinavian: "Stage this room with Scandinavian minimalist furniture. Pale woods, clean lines, natural textures, linen fabrics, neutral tones with muted greens. Add a simple plant. Bright, airy and calm.",
  modern: "Stage this room with clean contemporary modern furniture. Neutral palette of white, grey and charcoal. Sleek lines, statement pendant lighting, minimal accessories. Sophisticated and uncluttered.",
  traditional: "Stage this room with classic traditional British furniture. Rich warm tones, upholstered sofas, dark wooden pieces, ornate detailing. Framed artwork, table lamps, fresh flowers. Elegant and timeless.",
  industrial: "Stage this room with industrial-style furniture. Exposed metal frames, reclaimed wood, leather and concrete tones. Factory-style lighting, raw textures, urban and bold.",
  coastal: "Stage this room with coastal beach-house style furniture. Soft blues, whites and sandy neutrals. Natural rattan, jute and linen textures. Driftwood accents, coastal artwork. Light and breezy.",
  mid_century: "Stage this room with mid-century modern furniture. Organic shapes, tapered legs, teak and walnut wood tones. Bold accent colours, geometric patterns. Statement armchair and retro lighting. Stylish and characterful.",
};

function nextMidnightUtc(): Date {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

async function getOrCreateSession(sessionToken: string, ipAddress: string) {
  const now = new Date();

  let session = await prisma.redesignSession.findUnique({
    where: { sessionToken },
  });

  if (!session) {
    session = await prisma.redesignSession.create({
      data: {
        sessionToken,
        ipAddress,
        fullRedesigns: 0,
        restages: 0,
        resetAt: nextMidnightUtc(),
      },
    });
  } else if (now >= session.resetAt) {
    // Reset counters for the new day
    session = await prisma.redesignSession.update({
      where: { sessionToken },
      data: {
        fullRedesigns: 0,
        restages: 0,
        resetAt: nextMidnightUtc(),
      },
    });
  }

  return session;
}

export async function redesignRoutes(app: FastifyInstance) {
  // ── POST /redesign/full ────────────────────────────────────────────────────
  app.post("/redesign/full", async (request, reply) => {
    const headerToken = request.headers["x-redesign-session"] as string | undefined;
    const sessionToken = headerToken && headerToken.trim() ? headerToken.trim() : randomUUID();
    const ipAddress = (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? request.socket.remoteAddress
      ?? "unknown";

    const session = await getOrCreateSession(sessionToken, ipAddress);

    if (session.fullRedesigns >= 1) {
      reply.header("X-Redesign-Session", sessionToken);
      return reply.status(429).send({
        error: "rate_limited",
        message: "You've used your free redesign today. Sign up free for unlimited redesigns.",
      });
    }

    // Parse multipart
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "Missing photo file" });
    }

    if (!data.mimetype.startsWith("image/")) {
      return reply.status(400).send({ error: "File must be an image" });
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of data.file) {
      totalBytes += chunk.length;
      if (totalBytes > PHOTO_MAX_BYTES) {
        return reply.status(400).send({ error: "Photo must be under 10 MB" });
      }
      chunks.push(chunk);
    }
    const photoBuffer = Buffer.concat(chunks);

    // Read the style field — it comes after the file in the multipart stream
    // For Fastify multipart with a file field, non-file fields are in data.fields
    const styleField = (data.fields as Record<string, { value: string } | undefined>)?.style;
    const style = styleField?.value ?? "";

    if (!style || !STYLE_BRIEFS[style]) {
      return reply.status(400).send({ error: `Invalid style. Must be one of: ${Object.keys(STYLE_BRIEFS).join(", ")}` });
    }

    const brief = STYLE_BRIEFS[style];
    const photoData = photoBuffer.toString("base64");
    const photoMimeType = data.mimetype;
    const uuid = randomUUID();

    // Upload original
    const originalKey = `redesigns/${sessionToken}/${uuid}-original.png`;
    await storage.upload(originalKey, photoBuffer, photoMimeType);
    const originalUrl = storage.getUrl(originalKey);

    // Clear room
    const geminiCfg = {
      apiKey: config.ai.apiKey,
      model: config.ai.model,
      region: config.ai.region,
      reveApiKey: config.ai.reveApiKey,
    };

    const cleared = await clearFurnishedRoom(
      { reveApiKey: config.ai.reveApiKey },
      { photoData, photoMimeType }
    );

    const clearedKey = `redesigns/${sessionToken}/${uuid}-empty.png`;
    await storage.upload(clearedKey, cleared.buffer, "image/png");
    const clearedUrl = storage.getUrl(clearedKey);

    // Stage room
    const staged = await virtualStageRoom(geminiCfg, {
      photoData: cleared.buffer.toString("base64"),
      photoMimeType: "image/png",
      brief,
    });

    const stagedKey = `redesigns/${sessionToken}/${uuid}-staged.png`;
    await storage.upload(stagedKey, staged.buffer, "image/png");
    const stagedUrl = storage.getUrl(stagedKey);

    // Increment counter
    await prisma.redesignSession.update({
      where: { sessionToken },
      data: { fullRedesigns: { increment: 1 } },
    });

    reply.header("X-Redesign-Session", sessionToken);
    return reply.send({
      originalUrl,
      clearedUrl,
      stagedUrl,
      sessionToken,
      rateLimitInfo: {
        fullRemaining: 0,
        restagesRemaining: 2,
      },
    });
  });

  // ── POST /redesign/restage ─────────────────────────────────────────────────
  app.post("/redesign/restage", async (request, reply) => {
    const headerToken = request.headers["x-redesign-session"] as string | undefined;
    if (!headerToken || !headerToken.trim()) {
      return reply.status(400).send({ error: "Missing X-Redesign-Session header" });
    }
    const sessionToken = headerToken.trim();

    const ipAddress = (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? request.socket.remoteAddress
      ?? "unknown";

    const session = await getOrCreateSession(sessionToken, ipAddress);

    if (session.restages >= 2) {
      return reply.status(429).send({
        error: "rate_limited",
        message: "You've used all your free restyles. Sign up free for unlimited redesigns.",
      });
    }

    const body = request.body as { clearedUrl?: string; style?: string };
    const { clearedUrl, style } = body;

    if (!clearedUrl) {
      return reply.status(400).send({ error: "Missing clearedUrl" });
    }
    if (!style || !STYLE_BRIEFS[style]) {
      return reply.status(400).send({ error: `Invalid style. Must be one of: ${Object.keys(STYLE_BRIEFS).join(", ")}` });
    }

    const brief = STYLE_BRIEFS[style];

    // Fetch the cleared image
    const imgRes = await fetch(clearedUrl);
    if (!imgRes.ok) {
      return reply.status(400).send({ error: "Could not fetch cleared image" });
    }
    const clearedBuffer = Buffer.from(await imgRes.arrayBuffer());
    const photoData = clearedBuffer.toString("base64");

    const geminiCfg = {
      apiKey: config.ai.apiKey,
      model: config.ai.model,
      region: config.ai.region,
      reveApiKey: config.ai.reveApiKey,
    };

    const staged = await virtualStageRoom(geminiCfg, {
      photoData,
      photoMimeType: "image/png",
      brief,
    });

    const uuid = randomUUID();
    const stagedKey = `redesigns/${sessionToken}/${uuid}-staged.png`;
    await storage.upload(stagedKey, staged.buffer, "image/png");
    const stagedUrl = storage.getUrl(stagedKey);

    const updated = await prisma.redesignSession.update({
      where: { sessionToken },
      data: { restages: { increment: 1 } },
    });

    return reply.send({
      stagedUrl,
      rateLimitInfo: {
        restagesRemaining: Math.max(0, 2 - updated.restages),
      },
    });
  });
}
