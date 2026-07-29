import { prisma } from "./prisma.js";
import { storage } from "../services/storage.service.js";
import { logger } from "../services/logger.service.js";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TWO_DAYS_MS    = 2 * 24 * 60 * 60 * 1000;

export async function runCleanup(): Promise<void> {
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS);
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
  const twoDaysAgo    = new Date(Date.now() - TWO_DAYS_MS);

  // Delete renders for free-tier users older than 90 days
  const staleRenders = await prisma.render.findMany({
    where: {
      createdAt: { lt: ninetyDaysAgo },
      project: { user: { tier: "free" } },
    },
    select: { id: true, imageKey: true, alternativeImageKey: true },
  });

  if (staleRenders.length > 0) {
    for (const render of staleRenders) {
      if (render.imageKey && !render.imageKey.startsWith("http")) {
        await storage.delete(render.imageKey).catch(() => {});
      }
      if (render.alternativeImageKey && !render.alternativeImageKey.startsWith("http")) {
        await storage.delete(render.alternativeImageKey).catch(() => {});
      }
    }
    await prisma.render.deleteMany({
      where: { id: { in: staleRenders.map((r) => r.id) } },
    });
    logger.info("Cleanup: deleted stale free-tier renders", { count: staleRenders.length });
  }

  // Delete abandoned projects: created 30+ days ago with no render activity in
  // the last 30 days. Each user's most recent project is always kept — deleting
  // it would leave a returning dormant user with an empty dashboard (and it
  // erased our onboarding funnel data).
  const candidates = await prisma.project.findMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
      renders: { none: { createdAt: { gte: thirtyDaysAgo } } },
    },
    select: { id: true, userId: true, floorPlanKey: true },
  });

  const newestPerUser = await prisma.project.groupBy({
    by: ["userId"],
    where: { userId: { in: [...new Set(candidates.map((p) => p.userId))] } },
    _max: { createdAt: true },
  });
  const newestProjectIds = new Set<string>();
  for (const { userId, _max } of newestPerUser) {
    if (!_max.createdAt) continue;
    const newest = await prisma.project.findFirst({
      where: { userId, createdAt: _max.createdAt },
      select: { id: true },
    });
    if (newest) newestProjectIds.add(newest.id);
  }

  const abandonedProjects = candidates.filter((p) => !newestProjectIds.has(p.id));

  if (abandonedProjects.length > 0) {
    for (const project of abandonedProjects) {
      if (project.floorPlanKey) {
        await storage.delete(project.floorPlanKey).catch(() => {});
      }
    }
    await prisma.project.deleteMany({
      where: { id: { in: abandonedProjects.map((p) => p.id) } },
    });
    logger.info("Cleanup: deleted abandoned projects", { count: abandonedProjects.length });
  }

  // Delete redesign session files 48h+ after last activity.
  // The redesign session window is 24h, so anything older than 48h is dead weight —
  // staged/cleared images live only under redesigns/{sessionId}/.
  const staleSessions = await prisma.redesignSession.findMany({
    where: { lastResetAt: { lt: twoDaysAgo } },
    select: { id: true, sessionId: true },
  });

  if (staleSessions.length > 0) {
    let filesDeleted = 0;
    for (const session of staleSessions) {
      const keys = await storage.listByPrefix(`redesigns/${session.sessionId}/`).catch(() => [] as string[]);
      for (const key of keys) {
        await storage.delete(key).catch(() => {});
        filesDeleted++;
      }
    }
    await prisma.redesignSession.deleteMany({
      where: { id: { in: staleSessions.map((s) => s.id) } },
    });
    logger.info("Cleanup: deleted expired redesign sessions", { sessions: staleSessions.length, files: filesDeleted });
  }
}
