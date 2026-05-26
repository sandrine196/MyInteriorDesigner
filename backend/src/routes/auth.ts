import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../env.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/auth.js";
import { track } from "../lib/analytics.js";
import { exportUserData, deleteUserData } from "../services/gdpr.service.js";
import { emailService } from "../services/email.service.js";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");

const registerBody = z.object({
  email: z.string().email(),
  password: passwordSchema,
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const requestResetBody = z.object({ email: z.string().email() });
const resetPasswordBody = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

const authRateLimit = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: "1 hour",
      errorResponseBuilder: (_req: unknown, ctx: { max: number; ttl: number }) => ({
        error: `Too many attempts. Try again in ${Math.ceil(ctx.ttl / 60_000)} minutes.`,
        code: "AUTH_RATE_LIMIT",
      }),
    },
  },
} as const;

export async function authRoutes(app: FastifyInstance, env: Env) {
  app.post("/auth/register", authRateLimit, async (request, reply) => {
    const parsed = registerBody.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid email or password format";
      return reply.status(400).send({ error: msg });
    }
    const body = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }
    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash },
      select: { id: true, email: true, tier: true, isAdmin: true },
    });
    track("user_signup", user.id, { email: user.email });
    void emailService.sendWelcome(user.email);
    const token = await reply.jwtSign({ sub: user.id, email: user.email, tier: user.tier, isAdmin: user.isAdmin });
    return { token, user: { id: user.id, email: user.email, tier: user.tier, isAdmin: user.isAdmin } };
  });

  app.post("/auth/login", authRateLimit, async (request, reply) => {
    const parsed = loginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid login payload" });
    }
    const body = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }
    if (user.suspended) {
      return reply.status(403).send({ error: "Account suspended. Contact support.", code: "SUSPENDED" });
    }
    track("user_login", user.id);
    const token = await reply.jwtSign({ sub: user.id, email: user.email, tier: user.tier, isAdmin: user.isAdmin });
    return { token, user: { id: user.id, email: user.email, tier: user.tier, isAdmin: user.isAdmin } };
  });

  app.get(
    "/auth/me",
    { preHandler: [app.authenticate] },
    async (request) => {
      const u = request.user as { sub: string; email: string; tier: string; isAdmin: boolean };
      return { id: u.sub, email: u.email, tier: u.tier, isAdmin: u.isAdmin };
    }
  );

  app.post("/auth/request-reset", authRateLimit, async (request, reply) => {
    const parsed = requestResetBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid email" });
    }
    const { email } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });
      await emailService.sendPasswordReset(email, token);
    }
    return { message: "If that email is registered, a reset link has been logged to the console." };
  });

  app.post("/auth/reset-password", async (request, reply) => {
    const parsed = resetPasswordBody.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid request";
      return reply.status(400).send({ error: msg });
    }
    const { token, password } = parsed.data;
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return reply.status(400).send({ error: "Invalid or expired reset link" });
    }
    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    return { message: "Password updated successfully" };
  });

  // ── GET /me/export (GDPR right to access) ────────────────────────────────

  app.get(
    "/me/export",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const zip = await exportUserData(u.sub);
      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", 'attachment; filename="my-interior-designer-data.zip"');
      reply.header("Content-Length", zip.length);
      return reply.send(zip);
    }
  );

  // ── DELETE /me/delete-account (GDPR right to erasure) ────────────────────

  app.delete(
    "/me/delete-account",
    { preHandler: [app.authenticate] },
    async (request) => {
      const u = request.user as { sub: string; email: string };
      await deleteUserData(u.sub);
      // Fire-and-forget confirmation email (account is already gone, don't fail the response)
      void emailService.sendAccountDeleted(u.email);
      return { ok: true, message: "Account and all associated data have been deleted." };
    }
  );
}
