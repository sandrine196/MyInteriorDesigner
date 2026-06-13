import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma.js";
import { emailService } from "../services/email.service.js";
import { storage } from "../services/storage.service.js";
import { virtualStageRoom } from "../lib/gemini.js";
import { config } from "../config/index.js";

const STAGING_PHOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB — real photos are larger than floor plans

const registerBody = z.object({
  name:       z.string().min(1).max(100),
  agencyName: z.string().min(1).max(200),
  email:      z.string().email(),
  phone:      z.string().optional(),
});

function generateReferralCode(agencyName: string): string {
  const slug = agencyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  const suffix = randomBytes(3).toString("hex");
  return slug ? `${slug}-${suffix}` : `agent-${suffix}`;
}

export async function agentRoutes(app: FastifyInstance) {
  // ── POST /agents/register ─────────────────────────────────────────────────
  app.post("/agents/register", async (request, reply) => {
    const parsed = registerBody.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request";
      return reply.status(400).send({ error: msg });
    }
    const { name, agencyName, email, phone } = parsed.data;

    const existing = await prisma.agent.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "An agent account already exists for this email" });
    }

    const referralCode = generateReferralCode(agencyName);
    const agent = await prisma.agent.create({
      data: { name, agencyName, email, phone, referralCode },
    });

    // Generate QR code PNG
    const referralUrl = `${config.server.frontendUrl}?ref=${referralCode}`;
    let qrBuffer: Buffer;
    try {
      qrBuffer = await QRCode.toBuffer(referralUrl, {
        type: "png",
        width: 400,
        margin: 2,
        color: { dark: "#062C3D", light: "#FFFFFF" },
      });
    } catch (err) {
      console.error("[Agents] QR generation failed:", err);
      qrBuffer = Buffer.alloc(0);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const welcomeMagicToken = (app.jwt.sign as any)(
      { type: "agent_magic", agentId: agent.id, email: agent.email },
      { expiresIn: "24h" }
    ) as string;
    const welcomeMagicUrl = `${config.server.frontendUrl}/agent-auth?token=${welcomeMagicToken}`;
    void emailService.sendAgentWelcome(email, name, referralCode, qrBuffer, welcomeMagicUrl);

    return reply.status(201).send({
      ok: true,
      agent: {
        id:           agent.id,
        name:         agent.name,
        agencyName:   agent.agencyName,
        referralCode: agent.referralCode,
        referralUrl,
        dashboardUrl: `${config.server.frontendUrl}/agent-dashboard?code=${referralCode}`,
      },
    });
  });

  // ── POST /agents/magic-link — request a sign-in email ────────────────────
  app.post("/agents/magic-link", async (request, reply) => {
    const { email } = request.body as { email?: string };
    if (!email || !email.includes("@")) {
      return reply.status(400).send({ error: "Valid email required" });
    }

    const agent = await prisma.agent.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Always return 200 — don't reveal whether the email is registered
    if (!agent) {
      return { ok: true };
    }

    if (agent.status === "suspended") {
      // Still return 200 — suspended message shown on dashboard after login
      return { ok: true };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const magicToken = (app.jwt.sign as any)(
      { type: "agent_magic", agentId: agent.id, email: agent.email },
      { expiresIn: "15m" }
    ) as string;
    const magicUrl = `${config.server.frontendUrl}/agent-auth?token=${magicToken}`;

    void emailService.sendAgentMagicLink(agent.email, agent.name, magicUrl);

    return { ok: true };
  });

  // ── GET /agents/auth?token= — exchange magic token for session JWT ─────────
  app.get("/agents/auth", async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.status(400).send({ error: "Missing token" });

    let payload: Record<string, unknown>;
    try {
      payload = app.jwt.verify(token) as Record<string, unknown>;
    } catch {
      return reply.status(401).send({ error: "This sign-in link has expired or already been used. Please request a new one." });
    }

    if (payload.type !== "agent_magic" || typeof payload.agentId !== "string") {
      return reply.status(401).send({ error: "Invalid sign-in link." });
    }

    const agent = await prisma.agent.findUnique({ where: { id: payload.agentId } });
    if (!agent) return reply.status(404).send({ error: "Agent not found." });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessionToken = (app.jwt.sign as any)(
      { type: "agent_session", agentId: agent.id, email: agent.email, referralCode: agent.referralCode },
      { expiresIn: "30d" }
    ) as string;

    return {
      ok: true,
      token: sessionToken,
      agent: {
        name:         agent.name,
        agencyName:   agent.agencyName,
        referralCode: agent.referralCode,
        status:       agent.status,
      },
    };
  });

  // ── GET /agents/dashboard — authenticated ─────────────────────────────────
  app.get("/agents/dashboard", { preHandler: [app.authenticateAgent] }, async (request) => {
    const { agentId } = request.agentSession!;
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return { error: "Agent not found" };

    const referralUrl = `${config.server.frontendUrl}?ref=${agent.referralCode}`;

    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL(referralUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#062C3D", light: "#FFFFFF" },
      });
    } catch (err) {
      console.error("[Agents] QR data URL failed:", err);
    }

    return {
      name:            agent.name,
      agencyName:      agent.agencyName,
      referralCode:    agent.referralCode,
      referralUrl,
      clientsReferred: agent.clientsReferred,
      designsCreated:  agent.designsCreated,
      status:          agent.status,
      qrDataUrl,
    };
  });

  // ── GET /agents/qr?code= — download QR as PNG ─────────────────────────────
  app.get("/agents/qr", async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.status(400).send({ error: "Missing code" });

    const agent = await prisma.agent.findUnique({ where: { referralCode: code } });
    if (!agent) return reply.status(404).send({ error: "Agent not found" });

    const referralUrl = `${config.server.frontendUrl}?ref=${agent.referralCode}`;
    const qrBuffer = await QRCode.toBuffer(referralUrl, {
      type: "png",
      width: 800,
      margin: 3,
      color: { dark: "#062C3D", light: "#FFFFFF" },
    });

    reply.header("Content-Type", "image/png");
    reply.header("Content-Disposition", `attachment; filename="mid-qr-${code}.png"`);
    return reply.send(qrBuffer);
  });

  // ── Admin: GET /admin/agents ──────────────────────────────────────────────
  app.get("/admin/agents", { preHandler: [app.authenticateAdmin] }, async () => {
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, agencyName: true, email: true,
        referralCode: true, status: true, clientsReferred: true,
        designsCreated: true, createdAt: true,
      },
    });
    return { agents };
  });

  // ── Admin: PATCH /admin/agents/:id/status ─────────────────────────────────
  app.patch("/admin/agents/:id/status", { preHandler: [app.authenticateAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    if (!["pending", "active", "suspended"].includes(status)) {
      return reply.status(400).send({ error: "Invalid status" });
    }
    const agent = await prisma.agent.update({ where: { id }, data: { status } });
    return { ok: true, status: agent.status };
  });

  // ── POST /agents/staging ──────────────────────────────────────────────────
  // Virtual staging: agent uploads a real room photo + plain-English brief.
  // Gemini reads the actual photo and stages it according to the brief.
  app.post("/agents/staging", { preHandler: [app.authenticateAgent] }, async (request, reply) => {
    const { agentId } = request.agentSession!;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) return reply.status(404).send({ error: "Agent not found." });
    if (agent.status === "suspended") return reply.status(403).send({ error: "This partner account is suspended." });

    // Parse multipart: photo (file) + brief (text field)
    let photoBuffer: Buffer | null = null;
    let photoMimeType = "image/jpeg";
    let brief = "";

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "photo") {
        photoBuffer = await part.toBuffer();
        photoMimeType = part.mimetype;
      } else if (part.type === "field" && part.fieldname === "brief") {
        brief = (part.value as string).trim();
      }
    }

    if (!photoBuffer) return reply.status(400).send({ error: "Room photo is required" });
    if (photoBuffer.length > STAGING_PHOTO_MAX_BYTES) return reply.status(413).send({ error: "Photo must be under 10 MB" });
    if (!photoBuffer.length || !photoMimeType.startsWith("image/")) {
      return reply.status(400).send({ error: "Photo must be an image file (JPEG, PNG, or WebP)" });
    }
    if (!brief) return reply.status(400).send({ error: "Staging brief is required" });
    if (brief.length > 1000) return reply.status(400).send({ error: "Brief must be under 1000 characters" });

    const geminiCfg = { apiKey: config.ai.apiKey, model: config.ai.model, region: config.ai.region, reveApiKey: config.ai.reveApiKey };
    const result = await virtualStageRoom(geminiCfg, {
      photoData:     photoBuffer.toString("base64"),
      photoMimeType,
      brief,
    });

    const key = `agent-staging/${agentId}/${randomUUID()}.png`;
    await storage.upload(key, result.buffer, "image/png");

    void prisma.agent.update({
      where: { id: agentId },
      data:  { designsCreated: { increment: 1 } },
    }).catch((err) => console.error("[Agents] Failed to increment designsCreated:", err));

    return { ok: true, imageUrl: storage.getUrl(key), mock: result.mock };
  });
}
