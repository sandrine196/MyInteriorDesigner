import { randomBytes } from "node:crypto";
import { createRequire as _createRequire } from "node:module";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../env.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/auth.js";
import { track } from "../lib/analytics.js";
import { exportUserData, deleteUserData } from "../services/gdpr.service.js";
import { emailService, verifyUnsubToken } from "../services/email.service.js";

const _require        = _createRequire(import.meta.url);
const disposableDomains: string[] = _require("disposable-email-domains");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");

const registerBody = z.object({
  email:            z.string().email(),
  password:         passwordSchema,
  marketingConsent: z.boolean().optional().default(false),
  referredBy:       z.string().optional(),
  phone_number:     z.string().optional(), // honeypot — must stay empty
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

    // Honeypot — bots fill hidden fields; humans leave them blank
    if (body.phone_number && body.phone_number.length > 0) {
      console.log("[Bot] Honeypot triggered from", request.ip);
      // Return fake success — don't alert the bot
      return { token: "", user: { id: "", email: body.email, tier: "free", isAdmin: false, marketingConsent: false, emailVerified: false } };
    }

    // Block disposable email domains
    const emailDomain = body.email.toLowerCase().split("@")[1] ?? "";
    if (disposableDomains.includes(emailDomain)) {
      return reply.status(400).send({ error: "Please use a permanent email address to register." });
    }

    // Block heavily-dotted Gmail addresses — bots insert dots between every letter
    // to bypass duplicate checks (Gmail ignores dots). Real users never have 3+ dots.
    if (emailDomain === "gmail.com" || emailDomain === "googlemail.com") {
      const localPart = body.email.toLowerCase().split("@")[0] ?? "";
      const dotCount = (localPart.match(/\./g) ?? []).length;
      if (dotCount >= 3) {
        console.log("[Bot] Dotted Gmail rejected:", body.email, "from", request.ip);
        return reply.status(400).send({ error: "Please use your Gmail address without dots (Gmail ignores them)." });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }
    // Validate referral code if provided (silently ignore invalid codes)
    let validReferralCode: string | undefined;
    if (body.referredBy) {
      const agent = await prisma.agent.findUnique({ where: { referralCode: body.referredBy } });
      if (agent) validReferralCode = agent.referralCode;
    }

    const passwordHash     = await hashPassword(body.password);
    const verificationToken = randomBytes(32).toString("hex");
    const registerIp =
      (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? (request.headers["x-real-ip"] as string | undefined)
      ?? (request.headers["cf-connecting-ip"] as string | undefined)
      ?? request.ip
      ?? null;
    const user = await prisma.user.create({
      data: {
        email:                           body.email,
        passwordHash,
        marketingConsent:                body.marketingConsent,
        marketingConsentDate:            body.marketingConsent ? new Date() : null,
        referredBy:                      validReferralCode,
        lastLoginAt:                     new Date(),
        lastLoginIp:                     registerIp,
        emailVerified:                   false,
        emailVerificationToken:          verificationToken,
        emailVerificationTokenExpiry:    new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      select: { id: true, email: true, tier: true, isAdmin: true, marketingConsent: true },
    });
    track("user_signup", user.id, { email: user.email, referredBy: validReferralCode });
    void emailService.sendEmailVerification(user.email, verificationToken);

    // Increment agent's clientsReferred count
    if (validReferralCode) {
      void prisma.agent.update({
        where: { referralCode: validReferralCode },
        data:  { clientsReferred: { increment: 1 } },
      });
    }
    // Auto-create first project so the user lands somewhere useful
    const firstProject = await prisma.project.create({
      data: { userId: user.id, name: "My First Room" },
      select: { id: true },
    });

    const token = await reply.jwtSign({ sub: user.id, email: user.email, tier: user.tier, isAdmin: user.isAdmin });
    return { token, user: { id: user.id, email: user.email, tier: user.tier, isAdmin: user.isAdmin, marketingConsent: user.marketingConsent, emailVerified: false }, firstProjectId: firstProject.id };
  });

  // ── GET /auth/verify-email?token= ────────────────────────────────────────────

  app.get("/auth/verify-email", async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.status(400).send({ error: "Missing token" });

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken:       token,
        emailVerificationTokenExpiry: { gt: new Date() },
      },
      select: { id: true, email: true, tier: true, isAdmin: true },
    });

    if (!user) return reply.status(400).send({ error: "Invalid or expired verification link" });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified:                true,
        emailVerificationToken:       null,
        emailVerificationTokenExpiry: null,
      },
    });

    track("email_verified", user.id, { email: user.email });
    void emailService.sendWelcome(user.email);

    return { verified: true };
  });

  // ── POST /auth/resend-verification ───────────────────────────────────────────

  app.post("/auth/resend-verification", { preHandler: [app.authenticate], config: { rateLimit: { max: 3, timeWindow: "1 hour" } } }, async (request) => {
    const u = request.user as { sub: string; email: string };

    const user = await prisma.user.findUnique({
      where: { id: u.sub },
      select: { emailVerified: true },
    });

    if (!user || user.emailVerified) return { sent: false };

    const verificationToken = randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: u.sub },
      data: {
        emailVerificationToken:       verificationToken,
        emailVerificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    void emailService.sendEmailVerification(u.email, verificationToken);
    return { sent: true };
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
    const loginIp =
      (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? (request.headers["x-real-ip"] as string | undefined)
      ?? (request.headers["cf-connecting-ip"] as string | undefined)
      ?? request.ip
      ?? null;
    console.log("[Auth] Login IP debug — xff:", request.headers["x-forwarded-for"], "x-real-ip:", request.headers["x-real-ip"], "request.ip:", request.ip, "resolved:", loginIp);
    track("user_login", user.id);
    void prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastLoginIp: loginIp } })
      .catch((err) => console.error("[Auth] Failed to update lastLoginIp:", err));
    const token = await reply.jwtSign({ sub: user.id, email: user.email, tier: user.tier, isAdmin: user.isAdmin });
    return { token, user: { id: user.id, email: user.email, tier: user.tier, isAdmin: user.isAdmin } };
  });

  app.get(
    "/auth/me",
    { preHandler: [app.authenticate] },
    async (request) => {
      const u = request.user as { sub: string; email: string; tier: string; isAdmin: boolean };
      const user = await prisma.user.findUnique({
        where: { id: u.sub },
        select: { marketingConsent: true, emailVerified: true },
      });
      return { id: u.sub, email: u.email, tier: u.tier, isAdmin: u.isAdmin, marketingConsent: user?.marketingConsent ?? false, emailVerified: user?.emailVerified ?? false };
    }
  );

  // ── PATCH /me/marketing-consent ───────────────────────────────────────────

  app.patch(
    "/me/marketing-consent",
    { preHandler: [app.authenticate] },
    async (request) => {
      const u = request.user as { sub: string };
      const { consent } = request.body as { consent: boolean };
      await prisma.user.update({
        where: { id: u.sub },
        data: {
          marketingConsent:     consent,
          marketingConsentDate: new Date(),
        },
      });
      return { ok: true, marketingConsent: consent };
    }
  );

  // ── GET /unsubscribe (public, token-based) ────────────────────────────────

  app.get("/unsubscribe", async (request, reply) => {
    const { token } = request.query as { token?: string };
    if (!token) return reply.status(400).send({ error: "Missing token" });

    const email = verifyUnsubToken(token);
    if (!email) return reply.status(400).send({ error: "Invalid or tampered unsubscribe link" });

    await prisma.user.updateMany({
      where: { email: email.toLowerCase() },
      data: { marketingConsent: false, marketingConsentDate: new Date() },
    });
    return { ok: true };
  });

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
