import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "../lib/prisma.js";
import { emailService } from "../services/email.service.js";
import { storage } from "../services/storage.service.js";
import { aiService } from "../services/ai.service.js";
import { config } from "../config/index.js";

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

    void emailService.sendAgentWelcome(email, name, referralCode, qrBuffer);

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

  // ── GET /agents/dashboard?code= ───────────────────────────────────────────
  app.get("/agents/dashboard", async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.status(400).send({ error: "Missing code" });

    const agent = await prisma.agent.findUnique({ where: { referralCode: code } });
    if (!agent) return reply.status(404).send({ error: "Agent not found" });

    const referralUrl = `${config.server.frontendUrl}?ref=${agent.referralCode}`;

    // Generate QR data URL for display in the browser
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
      name:           agent.name,
      agencyName:     agent.agencyName,
      referralCode:   agent.referralCode,
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
  // Generate virtual staging renders for a property listing.
  // Gemini imagines the furniture freely — no affiliate product catalogue needed.
  const stagingBody = z.object({
    code:             z.string().min(1),
    roomType:         z.string().min(1).max(100),
    designStyles:     z.array(z.string()).min(1).max(3),
    wallColorPalette: z.string().optional(),
    flooringType:     z.string().optional(),
    roomLengthMm:     z.number().int().min(1000).max(30000),
    roomWidthMm:      z.number().int().min(1000).max(30000),
    ceilingHeightMm:  z.number().int().min(2000).max(6000),
  });

  app.post("/agents/staging", async (request, reply) => {
    const parsed = stagingBody.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request";
      return reply.status(400).send({ error: msg });
    }
    const { code, roomType, designStyles, wallColorPalette, flooringType, roomLengthMm, roomWidthMm, ceilingHeightMm } = parsed.data;

    const agent = await prisma.agent.findUnique({ where: { referralCode: code } });
    if (!agent) return reply.status(404).send({ error: "Agent not found. Check your partner code." });
    if (agent.status === "suspended") return reply.status(403).send({ error: "This partner account is suspended." });

    const room = { length: roomLengthMm, width: roomWidthMm, ceilingHeight: ceilingHeightMm };

    // Generate one render per requested style, in parallel.
    const renderResults = await Promise.all(
      designStyles.map(async (style) => {
        const result = await aiService.generateRoomImage({
          userPrompt:       `Virtual staging for a ${roomType} in ${style} style`,
          products:         [],
          room,
          projectName:      roomType,
          designStyle:      style,
          wallColorPalette: wallColorPalette ?? undefined,
          flooringType:     flooringType ?? undefined,
          virtualStaging:   true,
        });

        // Save primary render
        const key = `agent-staging/${agent.id}/${randomUUID()}.png`;
        await storage.upload(key, result.buffer, "image/png");

        return {
          style,
          imageUrl: storage.getUrl(key),
          mock:     result.mock,
        };
      })
    );

    // Fire-and-forget: count each staging job as a design
    void prisma.agent.update({
      where: { referralCode: code },
      data:  { designsCreated: { increment: designStyles.length } },
    }).catch((err) => console.error("[Agents] Failed to increment designsCreated:", err));

    return { ok: true, renders: renderResults };
  });
}
