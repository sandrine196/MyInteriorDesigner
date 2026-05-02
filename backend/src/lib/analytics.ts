import { prisma } from "./prisma.js";

export async function track(
  eventType: string,
  userId?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  prisma.analyticsEvent
    .create({
      data: {
        eventType,
        userId: userId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
    .catch(() => {}); // fire-and-forget; never block the request
}
