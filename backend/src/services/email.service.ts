import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { config } from "../config/index.js";

function displayName(email: string): string {
  const local = email.split("@")[0];
  const first = local.split(/[._+]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// ── Unsubscribe token helpers ──────────────────────────────────────────────────
// Token = base64url( email + ":" + HMAC-SHA256(email, JWT_SECRET) )
// No expiry — intentional for unsubscribe links.

function secret() {
  return process.env.JWT_SECRET ?? "dev-secret";
}

export function makeUnsubToken(email: string): string {
  const sig = createHmac("sha256", secret())
    .update(email.toLowerCase())
    .digest("hex");
  return Buffer.from(`${email}:${sig}`).toString("base64url");
}

export function verifyUnsubToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const idx = decoded.lastIndexOf(":");
    if (idx < 0) return null;
    const email = decoded.slice(0, idx);
    const sig   = decoded.slice(idx + 1);
    const expected = createHmac("sha256", secret())
      .update(email.toLowerCase())
      .digest("hex");
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return email;
  } catch {
    return null;
  }
}

function unsubFooter(to: string): string {
  const token = makeUnsubToken(to);
  const url   = `${config.server.frontendUrl}/unsubscribe?token=${token}`;
  return `<div style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;font-family:system-ui,sans-serif;">
    <p style="margin:0;">You're receiving this email because you have an account at My Interior Designer.</p>
    <p style="margin:4px 0 0;"><a href="${url}" style="color:#999;text-decoration:underline;">Unsubscribe from marketing emails</a></p>
  </div>`;
}

// ── Core send ──────────────────────────────────────────────────────────────────

async function send(subject: string, to: string, html: string): Promise<void> {
  const { provider, apiKey, from } = config.email;

  console.log("=== EMAIL ATTEMPT ===");
  console.log("To:", to, "| Subject:", subject, "| Provider:", provider, "| Key:", !!apiKey);

  if (provider !== "resend" || !apiKey) {
    console.log("=== EMAIL SKIPPED (provider:", provider, "/ key present:", !!apiKey, ") ===");
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({ from, to, subject, html: html + unsubFooter(to) });
    console.log("=== EMAIL SUCCESS ===", result);
  } catch (err) {
    const e = err as { message?: string; statusCode?: number };
    console.error("=== EMAIL FAILED ===", { message: e.message, code: e.statusCode, details: err });
    throw err;
  }
}

// ── Email methods ──────────────────────────────────────────────────────────────

export const emailService = {
  async sendWelcome(to: string): Promise<void> {
    const name = displayName(to);
    try {
      await send(
        "Welcome to My Interior Designer!",
        to,
        `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#062C3D;">Welcome, ${name}!</h2>
          <p>Thanks for joining My Interior Designer. You're now ready to transform your empty rooms into dream spaces.</p>
          <h3 style="color:#062C3D;font-size:18px;">Here's what you can do:</h3>
          <ul style="line-height:1.8;">
            <li>✨ Create up to 5 AI renders per month (free)</li>
            <li>🛋️ Browse furniture from top UK retailers</li>
            <li>💰 Set your budget and see what fits</li>
            <li>🛍️ Buy what you love with one-click affiliate links</li>
          </ul>
          <div style="margin:30px 0;">
            <a href="${config.server.frontendUrl}/projects" style="background:#D4A574;color:#062C3D;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">Start designing now →</a>
          </div>
          <p style="color:#666;font-size:14px;margin-top:40px;">Need help? Reply to this email or contact us at help@myinteriordesigner.co.uk</p>
        </div>`,
      );
    } catch {
      // Welcome email must never break registration
    }
  },

  async sendPasswordReset(to: string, resetToken: string): Promise<void> {
    const name     = displayName(to);
    const resetUrl = `${config.server.frontendUrl}/reset-password?token=${resetToken}`;
    try {
      await send(
        "Reset your password - My Interior Designer",
        to,
        `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#062C3D;">Reset your password</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="margin:30px 0;">
            <a href="${resetUrl}" style="background:#D4A574;color:#062C3D;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">Reset Password</a>
          </div>
          <p style="color:#666;font-size:14px;">Or copy this link: ${resetUrl}</p>
          <p style="color:#666;font-size:14px;">This link expires in 1 hour.</p>
          <p style="color:#666;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
        </div>`,
      );
    } catch {
      // Swallow so the route returns the friendly message
    }
  },

  async sendRenderReady(to: string, projectName: string, projectId: string): Promise<void> {
    const renderUrl = `${config.server.frontendUrl}/projects/${projectId}`;
    try {
      await send(
        `Your ${projectName} design is ready!`,
        to,
        `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#062C3D;">Your design is ready!</h2>
          <p>We've finished generating your AI-powered room design for <strong>"${projectName}"</strong>.</p>
          <div style="margin:30px 0;">
            <a href="${renderUrl}" style="background:#D4A574;color:#062C3D;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">View your design →</a>
          </div>
          <p>Love what you see? You can buy the furniture with one click.</p>
          <p style="color:#666;font-size:14px;margin-top:40px;">Happy with your design? Share it with friends who might need interior design help!</p>
        </div>`,
      );
    } catch {
      // Non-critical — render was still generated
    }
  },

  async sendUsageWarning(to: string, rendersUsed: number, rendersLimit: number): Promise<void> {
    const name = displayName(to);
    try {
      await send(
        "You're almost out of free renders",
        to,
        `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#062C3D;">Almost out of free renders</h2>
          <p>Hi ${name},</p>
          <p>You've used <strong>${rendersUsed} of your ${rendersLimit}</strong> free renders this month.</p>
          <p>Want unlimited designs? Upgrade to Pro and unlock:</p>
          <ul style="line-height:1.8;">
            <li>✨ Unlimited AI renders</li>
            <li>⚡ Priority generation</li>
            <li>🎨 Early access to new features</li>
          </ul>
          <p style="font-size:24px;font-weight:600;color:#062C3D;margin:20px 0;">Only £9.99/month</p>
          <div style="margin:30px 0;">
            <a href="${config.server.frontendUrl}/pricing" style="background:#D4A574;color:#062C3D;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">Upgrade to Pro →</a>
          </div>
        </div>`,
      );
    } catch {
      // Non-critical
    }
  },

  async sendAgentMagicLink(to: string, name: string, magicUrl: string): Promise<void> {
    try {
      await send(
        "Your sign-in link — My Interior Designer Partners",
        to,
        `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#062C3D;">Sign in to your partner dashboard</h2>
          <p>Hi ${name},</p>
          <p>Click the button below to sign in. This link expires in <strong>15 minutes</strong>.</p>
          <div style="margin:30px 0;">
            <a href="${magicUrl}" style="background:#D4A574;color:#062C3D;padding:14px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:15px;">
              Sign in to my dashboard →
            </a>
          </div>
          <p style="color:#666;font-size:13px;">Or copy this link into your browser:</p>
          <p style="background:#f5f5f5;padding:10px 14px;border-radius:6px;font-family:monospace;font-size:12px;word-break:break-all;color:#333;">${magicUrl}</p>
          <p style="color:#999;font-size:12px;margin-top:32px;">If you didn't request this, you can safely ignore this email. No action needed.</p>
        </div>`,
      );
    } catch {
      // Non-fatal — agent sees a generic success message regardless
    }
  },

  async sendAgentWelcome(to: string, name: string, referralCode: string, qrPngBuffer: Buffer, magicUrl?: string): Promise<void> {
    const referralUrl = `${config.server.frontendUrl}?ref=${referralCode}`;
    const { provider, apiKey, from } = config.email;
    if (provider !== "resend" || !apiKey) {
      console.log("[Email] Skipping agent welcome (no provider configured)");
      return;
    }
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from, to,
        subject: "Welcome to MyInteriorDesigner Partners!",
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#062C3D;">Welcome to the partner programme, ${name}!</h2>
          <p>You're all set. Here's everything you need to get started:</p>
          <h3 style="color:#062C3D;">Your unique referral link</h3>
          <p style="background:#f5f5f5;padding:12px 16px;border-radius:8px;font-family:monospace;word-break:break-all;">
            <a href="${referralUrl}" style="color:#062C3D;">${referralUrl}</a>
          </p>
          <p>Share this link with your buyers — when they visit it, they'll get a free AI interior design session as a gift from you.</p>
          <h3 style="color:#062C3D;">Your QR code</h3>
          <p>Your personal QR code is attached as a PNG. Print it, add it to your completion packs, or share it digitally.</p>
          <p>When buyers scan it:</p>
          <ul style="line-height:1.8;">
            <li>🎁 They get a free design session — a memorable gift from you</li>
            <li>📐 They upload their floor plan and choose their style</li>
            <li>🛋️ They get AI renders with real UK furniture</li>
            <li>📊 You can track usage from your partner dashboard</li>
          </ul>
          <h3 style="color:#062C3D;">Your partner dashboard</h3>
          <p>Track how many clients have used your link and created designs — and use virtual staging to present any empty room instantly.</p>
          <div style="margin:20px 0;">
            <a href="${magicUrl ?? `${config.server.frontendUrl}/agent-login`}"
              style="background:#D4A574;color:#062C3D;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">
              Go to my dashboard →
            </a>
          </div>
          ${magicUrl ? `<p style="color:#999;font-size:12px;">This sign-in link expires in 24 hours. After that, visit <a href="${config.server.frontendUrl}/agent-login" style="color:#062C3D;">${config.server.frontendUrl}/agent-login</a> to request a new one.</p>` : ""}
          <p style="color:#666;font-size:14px;margin-top:40px;">Questions? Email us at hello@myinteriordesigner.co.uk — we're happy to help.</p>
        </div>`,
        attachments: [{
          filename: `mid-qr-${referralCode}.png`,
          content: qrPngBuffer.toString("base64"),
        }],
      });
      console.log("[Email] Agent welcome sent to", to);
    } catch (err) {
      console.error("[Email] Agent welcome failed:", err);
      // Non-fatal — agent record is already created
    }
  },

  async sendAccountDeleted(to: string): Promise<void> {
    // Intentionally no unsubscribe footer — account is already gone
    const { provider, apiKey, from } = config.email;
    if (provider !== "resend" || !apiKey) return;
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from, to,
        subject: "Your My Interior Designer account has been deleted",
        html: `<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#062C3D;">Account deleted</h2>
          <p>Your account has been permanently deleted. All your data has been removed from our systems, including:</p>
          <ul style="line-height:1.8;color:#444;">
            <li>Your profile and login credentials</li>
            <li>All room projects and settings</li>
            <li>All generated room renders</li>
            <li>Your product click history</li>
          </ul>
          <p>This action is irreversible. If you change your mind, you're welcome to create a new account at any time.</p>
          <div style="margin:30px 0;">
            <a href="${config.server.frontendUrl}" style="background:#D4A574;color:#062C3D;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">Visit My Interior Designer</a>
          </div>
          <p style="color:#666;font-size:14px;margin-top:40px;">Questions? Contact us at help@myinteriordesigner.co.uk</p>
        </div>`,
      });
    } catch {
      // Non-critical — account is already deleted
    }
  },
};
