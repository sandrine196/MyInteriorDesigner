import { Resend } from "resend";
import { config } from "../config/index.js";

// Derive a friendly display name from an email address.
// "sandrine.andre@example.com" → "Sandrine"
function displayName(email: string): string {
  const local = email.split("@")[0];
  const first = local.split(/[._+]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

class EmailService {
  private resend: Resend | null = null;

  private client(): Resend | null {
    if (config.email.provider !== "resend" || !config.email.apiKey) return null;
    if (!this.resend) this.resend = new Resend(config.email.apiKey);
    return this.resend;
  }

  async sendPasswordReset(to: string, resetToken: string): Promise<void> {
    const name = displayName(to);
    const resetUrl = `${config.server.frontendUrl}/reset-password?token=${resetToken}`;
    const client = this.client();
    if (!client) {
      console.log(`[Password Reset] ${to} → ${resetUrl}`);
      return;
    }
    await client.emails.send({
      from: config.email.from,
      to,
      subject: "Reset your password - My Interior Designer",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#062C3D;">Reset your password</h2>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="margin:30px 0;">
            <a href="${resetUrl}" style="background:#D4A574;color:#062C3D;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">Reset Password</a>
          </div>
          <p style="color:#666;font-size:14px;">Or copy this link: ${resetUrl}</p>
          <p style="color:#666;font-size:14px;">This link expires in 1 hour.</p>
          <p style="color:#666;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  }

  async sendWelcome(to: string): Promise<void> {
    const name = displayName(to);
    const client = this.client();
    if (!client) return;
    try {
      await client.emails.send({
        from: config.email.from,
        to,
        subject: "Welcome to My Interior Designer!",
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
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
          </div>
        `,
      });
    } catch (err) {
      // Welcome email failure must not break registration
      console.error("Failed to send welcome email:", err);
    }
  }

  async sendRenderReady(to: string, projectName: string, projectId: string): Promise<void> {
    const client = this.client();
    if (!client) return;
    try {
      const renderUrl = `${config.server.frontendUrl}/projects/${projectId}`;
      await client.emails.send({
        from: config.email.from,
        to,
        subject: `Your ${projectName} design is ready!`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#062C3D;">Your design is ready!</h2>
            <p>We've finished generating your AI-powered room design for <strong>"${projectName}"</strong>.</p>
            <div style="margin:30px 0;">
              <a href="${renderUrl}" style="background:#D4A574;color:#062C3D;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">View your design →</a>
            </div>
            <p>Love what you see? You can buy the furniture with one click.</p>
            <p style="color:#666;font-size:14px;margin-top:40px;">Happy with your design? Share it with friends who might need interior design help!</p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send render ready email:", err);
    }
  }

  async sendUsageWarning(to: string, rendersUsed: number, rendersLimit: number): Promise<void> {
    const name = displayName(to);
    const client = this.client();
    if (!client) return;
    try {
      await client.emails.send({
        from: config.email.from,
        to,
        subject: "You're almost out of free renders",
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;">
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
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send usage warning email:", err);
    }
  }
}

export const emailService = new EmailService();
