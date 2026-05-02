import { prisma } from "./prisma.js";
import type { Env } from "../env.js";

/**
 * Called before each render attempt.
 * - At exactly 50 renders today: sends an alert email (non-blocking).
 * - At >= 100 renders today: auto-suspends the account.
 * Returns true if the account was suspended (caller should reject the request).
 */
export async function checkSuspiciousActivity(
  userId: string,
  userEmail: string,
  rendersToday: number,
  env: Env
): Promise<boolean> {
  if (rendersToday === 50) {
    const msg =
      `[ALERT] User ${userEmail} (${userId}) has created ${rendersToday} renders today ` +
      `— possible abuse. Check the dashboard.`;
    console.warn(msg);
    sendAlertEmail(msg, env).catch(() => {});
  }

  if (rendersToday >= 100) {
    console.warn(
      `[AUTO-SUSPEND] Suspending ${userEmail} (${userId}) — ${rendersToday} renders today`
    );
    await prisma.user.update({ where: { id: userId }, data: { suspended: true } });
    const msg =
      `[AUTO-SUSPEND] Account ${userEmail} (${userId}) auto-suspended — ` +
      `${rendersToday} renders today. Manual unlock required.`;
    sendAlertEmail(msg, env).catch(() => {});
    return true;
  }

  return false;
}

async function sendAlertEmail(message: string, env: Env): Promise<void> {
  if (!env.ALERT_EMAIL) return;
  // To enable email alerts, add nodemailer and configure SMTP_URL in your .env:
  //   SMTP_URL=smtp://user:pass@smtp.example.com
  //   ALERT_EMAIL=you@yourcompany.com
  // Then uncomment the block below and run: npm install nodemailer
  //
  // const { createTransport } = await import("nodemailer");
  // const transport = createTransport(process.env.SMTP_URL);
  // await transport.sendMail({
  //   from: "alerts@myinteriordesigner.co.uk",
  //   to: env.ALERT_EMAIL,
  //   subject: "[My Interior Designer] Suspicious activity alert",
  //   text: message,
  // });
  console.warn(`[EMAIL-ALERT → ${env.ALERT_EMAIL}]`, message);
}
