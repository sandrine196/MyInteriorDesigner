import { zipSync } from "fflate";
import { prisma } from "../lib/prisma.js";
import { storage } from "./storage.service.js";

// ── GDPR right to access ───────────────────────────────────────────────────────

export async function exportUserData(userId: string): Promise<Buffer> {
  const [user, projects, clicks, events] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tier: true, createdAt: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        renders: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: {
            id: true, status: true, prompt: true,
            imageKey: true, errorMessage: true, createdAt: true,
          },
        },
      },
    }),
    prisma.productClick.findMany({
      where: { userId },
      orderBy: { clickedAt: "asc" },
      select: { productName: true, retailer: true, clickedAt: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { eventType: true, metadata: true, createdAt: true },
    }),
  ]);

  // profile.json
  const profile = {
    exportedAt: new Date().toISOString(),
    id:        user?.id,
    email:     user?.email,
    tier:      user?.tier,
    createdAt: user?.createdAt,
  };

  // projects.json — render image keys replaced with local ZIP paths
  const projectsExport = projects.map((p) => ({
    id:            p.id,
    name:          p.name,
    roomType:      p.roomType,
    designStyle:   p.designStyle,
    budgetMin:     p.budgetMin,
    budgetMax:     p.budgetMax,
    roomLengthMm:  p.roomLengthMm,
    roomWidthMm:   p.roomWidthMm,
    ceilingHeightMm: p.ceilingHeightMm,
    wallColorPalette: p.wallColorPalette,
    flooringType:  p.flooringType,
    preferredRetailers: (() => {
      try { return JSON.parse(p.preferredRetailers ?? "[]"); } catch { return []; }
    })(),
    createdAt: p.createdAt,
    renders: p.renders.map((r) => ({
      id:           r.id,
      status:       r.status,
      prompt:       r.prompt,
      imageFile:    r.imageKey ? `renders/${r.id}.png` : null,
      errorMessage: r.errorMessage,
      createdAt:    r.createdAt,
    })),
  }));

  // usage.json
  const usageExport = {
    productClicks: clicks,
    analyticsEvents: events.map((e) => ({
      eventType: e.eventType,
      createdAt: e.createdAt,
      metadata: (() => {
        try { return e.metadata ? JSON.parse(e.metadata) : null; } catch { return e.metadata; }
      })(),
    })),
  };

  const enc = (obj: unknown) => new Uint8Array(Buffer.from(JSON.stringify(obj, null, 2)));

  const files: Record<string, Uint8Array> = {
    "profile.json":  enc(profile),
    "projects.json": enc(projectsExport),
    "usage.json":    enc(usageExport),
  };

  // Download render images in parallel (best-effort — missing files are skipped)
  const renderEntries = projects.flatMap((p) =>
    p.renders
      .filter((r) => r.imageKey)
      .map((r) => ({ id: r.id, imageKey: r.imageKey! })),
  );

  await Promise.all(
    renderEntries.map(async ({ id, imageKey }) => {
      try {
        let buf: Buffer;
        if (imageKey.startsWith("http")) {
          const res = await fetch(imageKey);
          if (!res.ok) return;
          buf = Buffer.from(await res.arrayBuffer());
        } else {
          buf = await storage.download(imageKey);
        }
        files[`renders/${id}.png`] = new Uint8Array(buf);
      } catch {
        // skip missing or inaccessible renders
      }
    }),
  );

  return Buffer.from(zipSync(files, { level: 1 }));
}

// ── GDPR right to erasure ──────────────────────────────────────────────────────

export async function deleteUserData(userId: string): Promise<void> {
  // Collect storage keys and render count before any deletion
  const projects = await prisma.project.findMany({
    where: { userId },
    select: {
      floorPlanKey: true,
      renders: { select: { imageKey: true } },
    },
  });

  const renderCount = projects.reduce((n, p) => n + p.renders.length, 0);

  // Delete files from storage in parallel (best-effort — DB deletion proceeds even on failure)
  await Promise.all(
    projects.flatMap((p) => {
      const keys: string[] = [];
      if (p.floorPlanKey) keys.push(p.floorPlanKey);
      for (const r of p.renders) {
        if (r.imageKey && !r.imageKey.startsWith("http")) keys.push(r.imageKey);
      }
      return keys.map((k) => storage.delete(k).catch(() => {}));
    }),
  );

  // Delete non-cascaded records linked by userId
  await Promise.all([
    prisma.productClick.deleteMany({ where: { userId } }),
    prisma.analyticsEvent.deleteMany({ where: { userId } }),
  ]);

  // Preserve anonymised aggregate signal (no userId attached)
  await prisma.analyticsEvent.create({
    data: {
      eventType: "account_deleted",
      metadata:  JSON.stringify({ renderCount }),
    },
  });

  // Delete user — Prisma cascade removes projects → renders → passwordResetTokens
  await prisma.user.delete({ where: { id: userId } });
}
