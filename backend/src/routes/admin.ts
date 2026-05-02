import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

const COST_PER_RENDER_GBP = 0.03;
const PRO_PRICE_GBP = 9.99;

function parseRetailers(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

/** Build a 30-day day-by-day count array, oldest first. */
function groupByDay(dates: Date[]): Array<{ date: string; count: number }> {
  const result: Array<{ date: string; count: number }> = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    result.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  for (const d of dates) {
    const key = d.toISOString().slice(0, 10);
    const slot = result.find((r) => r.date === key);
    if (slot) slot.count++;
  }
  return result;
}

function csvRow(values: (string | number | boolean | null)[]): string {
  return values
    .map((v) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`))
    .join(",");
}

export async function adminRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticateAdmin] };

  // ── GET /admin/metrics ────────────────────────────────────────────────────

  app.get("/admin/metrics", auth, async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      freeUsers,
      proUsers,
      newSignups7d,
      totalRenders,
      // Fetch everything needed for derived metrics in parallel
      projectsForStats,
      allUsersWithRenders,
      recentSignups,
      recentRendersRaw,
      signupsLast30,
      rendersLast30,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { tier: "free" } }),
      prisma.user.count({ where: { tier: "pro" } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.render.count(),

      // For style/retailer/budget stats
      prisma.project.findMany({
        where: { designStyle: { not: null } },
        select: { designStyle: true, preferredRetailers: true, budgetMax: true },
      }),

      // For top-users table (user → projects → renders)
      prisma.user.findMany({
        select: {
          id: true, email: true, tier: true, createdAt: true,
          projects: { select: { renders: { select: { id: true } } } },
        },
      }),

      // Recent signups
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, email: true, tier: true, createdAt: true },
      }),

      // Recent renders with project + user info
      prisma.render.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, status: true, imageKey: true, prompt: true, createdAt: true,
          project: { select: { name: true, user: { select: { email: true } } } },
        },
      }),

      // 30-day time series
      prisma.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.render.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
    ]);

    // Active users: distinct users with a render in the last 7 days
    const recentRenderUserIds = await prisma.render.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { project: { select: { userId: true } } },
    });
    const activeUsers7d = new Set(recentRenderUserIds.map((r) => r.project.userId)).size;

    // ── Financial ────────────────────────────────────────────────────────────
    const mrr = proUsers * PRO_PRICE_GBP;
    const estimatedGeminiCosts = totalRenders * COST_PER_RENDER_GBP;
    const revenuePerUser = totalUsers > 0 ? mrr / totalUsers : 0;

    // ── Design style distribution ─────────────────────────────────────────────
    const styleCount: Record<string, number> = {};
    for (const p of projectsForStats) {
      if (p.designStyle) {
        styleCount[p.designStyle] = (styleCount[p.designStyle] ?? 0) + 1;
      }
    }
    const designStyleDistribution = Object.entries(styleCount)
      .map(([style, count]) => ({ style, count }))
      .sort((a, b) => b.count - a.count);

    // ── Retailer distribution ─────────────────────────────────────────────────
    const retailerCount: Record<string, number> = {};
    for (const p of projectsForStats) {
      for (const r of parseRetailers(p.preferredRetailers)) {
        retailerCount[r] = (retailerCount[r] ?? 0) + 1;
      }
    }
    const retailerDistribution = Object.entries(retailerCount)
      .map(([retailer, count]) => ({ retailer, count }))
      .sort((a, b) => b.count - a.count);

    // ── Average budget ────────────────────────────────────────────────────────
    const budgets = projectsForStats.map((p) => p.budgetMax).filter((b): b is number => b != null);
    const averageBudget = budgets.length > 0 ? Math.round(budgets.reduce((s, b) => s + b, 0) / budgets.length) : null;

    // ── Top users by render count ─────────────────────────────────────────────
    const usersWithCounts = allUsersWithRenders
      .map((u) => ({
        id: u.id,
        email: u.email,
        tier: u.tier,
        createdAt: u.createdAt.toISOString(),
        renderCount: u.projects.reduce((sum, p) => sum + p.renders.length, 0),
      }))
      .sort((a, b) => b.renderCount - a.renderCount)
      .slice(0, 10);

    const rendersPerUser = totalUsers > 0 ? totalRenders / totalUsers : 0;

    return {
      users: { total: totalUsers, free: freeUsers, pro: proUsers },
      newSignups7d,
      totalRenders,
      activeUsers7d,

      mrr: Math.round(mrr * 100) / 100,
      estimatedGeminiCosts: Math.round(estimatedGeminiCosts * 100) / 100,
      revenuePerUser: Math.round(revenuePerUser * 100) / 100,
      costPerRender: COST_PER_RENDER_GBP,

      designStyleDistribution,
      retailerDistribution,
      averageBudget,
      rendersPerUser: Math.round(rendersPerUser * 10) / 10,

      topUsers: usersWithCounts,
      recentSignups: recentSignups.map((u) => ({
        id: u.id, email: u.email, tier: u.tier, createdAt: u.createdAt.toISOString(),
      })),
      recentRenders: recentRendersRaw.map((r) => ({
        id: r.id,
        status: r.status,
        imageUrl: r.imageKey
          ? r.imageKey.startsWith("http") ? r.imageKey : `/uploads/${r.imageKey}`
          : null,
        prompt: r.prompt.slice(0, 80),
        createdAt: r.createdAt.toISOString(),
        projectName: r.project.name,
        userEmail: r.project.user.email,
      })),

      signupsPerDay: groupByDay(signupsLast30.map((u) => u.createdAt)),
      rendersPerDay: groupByDay(rendersLast30.map((r) => r.createdAt)),
    };
  });

  // ── GET /admin/export/users ───────────────────────────────────────────────

  app.get("/admin/export/users", auth, async (_req, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, tier: true, suspended: true, isAdmin: true, createdAt: true },
    });
    const header = "id,email,tier,suspended,isAdmin,createdAt";
    const rows = users.map((u) =>
      csvRow([u.id, u.email, u.tier, u.suspended, u.isAdmin, u.createdAt.toISOString()])
    );
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", 'attachment; filename="users.csv"');
    return [header, ...rows].join("\n");
  });

  // ── GET /admin/export/renders ─────────────────────────────────────────────

  app.get("/admin/export/renders", auth, async (_req, reply) => {
    const renders = await prisma.render.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true, status: true, prompt: true, createdAt: true,
        project: { select: { id: true, name: true, user: { select: { email: true } } } },
      },
    });
    const header = "id,status,prompt,projectId,projectName,userEmail,createdAt";
    const rows = renders.map((r) =>
      csvRow([
        r.id, r.status, r.prompt.slice(0, 200),
        r.project.id, r.project.name, r.project.user.email,
        r.createdAt.toISOString(),
      ])
    );
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", 'attachment; filename="renders.csv"');
    return [header, ...rows].join("\n");
  });

  // ── POST /events (frontend event tracking) ────────────────────────────────

  app.post(
    "/events",
    { preHandler: [app.authenticate] },
    async (request) => {
      const u = request.user as { sub: string };
      const body = request.body as { eventType?: string; metadata?: Record<string, unknown> };
      if (typeof body?.eventType === "string") {
        // fire-and-forget (analytics.ts pattern)
        prisma.analyticsEvent.create({
          data: {
            eventType: body.eventType,
            userId: u.sub,
            metadata: body.metadata ? JSON.stringify(body.metadata) : null,
          },
        }).catch(() => {});
      }
      return { ok: true };
    }
  );
}
