import { prisma } from "../lib/prisma.js";
import { storage } from "./storage.service.js";

// ── GDPR right to access ───────────────────────────────────────────────────────

export async function exportUserData(userId: string) {
  const [user, projects] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tier: true, createdAt: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        budgetMin: true,
        budgetMax: true,
        designStyle: true,
        preferredRetailers: true,
        roomLengthMm: true,
        roomWidthMm: true,
        ceilingHeightMm: true,
        renders: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            prompt: true,
            errorMessage: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user,
    projects: projects.map((p) => ({
      ...p,
      preferredRetailers: (() => {
        try { return JSON.parse(p.preferredRetailers ?? "[]"); } catch { return []; }
      })(),
    })),
  };
}

// ── GDPR right to erasure ──────────────────────────────────────────────────────

export async function deleteUserData(userId: string): Promise<void> {
  // Collect storage keys before cascade-deleting DB records
  const projects = await prisma.project.findMany({
    where: { userId },
    select: {
      floorPlanKey: true,
      renders: { select: { imageKey: true } },
    },
  });

  // Delete files from storage (best-effort — DB deletion proceeds even if storage fails)
  for (const project of projects) {
    if (project.floorPlanKey) {
      await storage.delete(project.floorPlanKey).catch(() => {});
    }
    for (const render of project.renders) {
      if (render.imageKey && !render.imageKey.startsWith("http")) {
        await storage.delete(render.imageKey).catch(() => {});
      }
    }
  }

  // Prisma cascade (onDelete: Cascade) handles renders → projects automatically
  await prisma.user.delete({ where: { id: userId } });
}
