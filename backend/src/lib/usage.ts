import { prisma } from "./prisma.js";

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export async function countSuccessfulRendersThisMonth(userId: string): Promise<number> {
  const since = startOfUtcMonth(new Date());
  return prisma.render.count({
    where: { createdAt: { gte: since }, status: "done", project: { userId } },
  });
}

// Failed renders are excluded from every quota/rate-limit count below —
// a Gemini or Reve failure should never cost the user part of their
// allowance. "pending" still counts so an in-flight render is charged
// against the limit as soon as it's requested, not only once it succeeds.

export async function countRendersToday(userId: string): Promise<number> {
  const since = startOfUtcDay(new Date());
  return prisma.render.count({
    where: { createdAt: { gte: since }, status: { not: "failed" }, project: { userId } },
  });
}

export async function countRendersThisHour(userId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.render.count({
    where: { createdAt: { gte: since }, status: { not: "failed" }, project: { userId } },
  });
}

export async function countPendingRenders(userId: string): Promise<number> {
  return prisma.render.count({
    where: { status: "pending", project: { userId } },
  });
}

export async function countUserProjects(userId: string): Promise<number> {
  return prisma.project.count({ where: { userId } });
}

export async function countGlobalPendingRenders(): Promise<number> {
  return prisma.render.count({ where: { status: "pending" } });
}

export async function getLastRenderTimeForProject(projectId: string): Promise<Date | null> {
  const render = await prisma.render.findFirst({
    where: { projectId, status: "done" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return render?.createdAt ?? null;
}
