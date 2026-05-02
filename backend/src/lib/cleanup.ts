import { prisma } from "./prisma.js";
import { storage } from "../services/storage.service.js";
import { logger } from "../services/logger.service.js";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function runCleanup(): Promise<void> {
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS);
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

  // Delete renders for free-tier users older than 90 days
  const staleRenders = await prisma.render.findMany({
    where: {
      createdAt: { lt: ninetyDaysAgo },
      project: { user: { tier: "free" } },
    },
    select: { id: true, imageKey: true },
  });

  if (staleRenders.length > 0) {
    for (const render of staleRenders) {
      if (render.imageKey && !render.imageKey.startsWith("http")) {
        await storage.delete(render.imageKey).catch(() => {});
      }
    }
    await prisma.render.deleteMany({
      where: { id: { in: staleRenders.map((r) => r.id) } },
    });
    logger.info("Cleanup: deleted stale free-tier renders", { count: staleRenders.length });
  }

  // Delete abandoned projects: created 30+ days ago with no render activity in the last 30 days.
  const abandonedProjects = await prisma.project.findMany({
    where: {
      createdAt: { lt: thirtyDaysAgo },
      renders: { none: { createdAt: { gte: thirtyDaysAgo } } },
    },
    select: { id: true, floorPlanKey: true },
  });

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
}
