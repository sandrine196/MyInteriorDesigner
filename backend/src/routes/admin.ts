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

  // ── Cost entries ───────────────────────────────────────────────────────────

  app.get("/admin/costs", auth, async (request) => {
    const { month, year } = request.query as { month?: string; year?: string };
    const now = new Date();
    const m = month ? parseInt(month) : now.getUTCMonth() + 1;
    const y = year  ? parseInt(year)  : now.getUTCFullYear();
    const entries = await prisma.costEntry.findMany({
      where: { month: m, year: y },
      orderBy: { createdAt: "asc" },
    });
    return { entries };
  });

  app.post("/admin/costs", auth, async (request, reply) => {
    const b = request.body as {
      provider: string; plan: string; monthlyCostGbp: number;
      month: number; year: number; status?: string; notes?: string;
    };
    const entry = await prisma.costEntry.create({
      data: {
        provider: b.provider, plan: b.plan,
        monthlyCostGbp: b.monthlyCostGbp,
        month: b.month, year: b.year,
        status: b.status ?? "active",
        notes: b.notes ?? null,
      },
    });
    return reply.status(201).send({ entry });
  });

  app.put("/admin/costs/:id", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const b = request.body as {
      provider?: string; plan?: string; monthlyCostGbp?: number;
      status?: string; notes?: string;
    };
    const entry = await prisma.costEntry.update({
      where: { id },
      data: {
        ...(b.provider        !== undefined && { provider:        b.provider }),
        ...(b.plan            !== undefined && { plan:            b.plan }),
        ...(b.monthlyCostGbp  !== undefined && { monthlyCostGbp:  b.monthlyCostGbp }),
        ...(b.status          !== undefined && { status:          b.status }),
        ...(b.notes           !== undefined && { notes:           b.notes }),
      },
    });
    return { entry };
  });

  app.delete("/admin/costs/:id", auth, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.costEntry.delete({ where: { id } });
    return { ok: true };
  });

  // ── Revenue entries ────────────────────────────────────────────────────────

  app.get("/admin/revenues", auth, async (request) => {
    const { month, year } = request.query as { month?: string; year?: string };
    const now = new Date();
    const m = month ? parseInt(month) : now.getUTCMonth() + 1;
    const y = year  ? parseInt(year)  : now.getUTCFullYear();
    const entries = await prisma.revenueEntry.findMany({
      where: { month: m, year: y },
      orderBy: { createdAt: "asc" },
    });
    return { entries };
  });

  app.post("/admin/revenues", auth, async (request, reply) => {
    const b = request.body as {
      source: string; type: string; amountGbp: number;
      month: number; year: number; notes?: string;
    };
    const entry = await prisma.revenueEntry.create({
      data: {
        source: b.source, type: b.type,
        amountGbp: b.amountGbp,
        month: b.month, year: b.year,
        notes: b.notes ?? null,
      },
    });
    return reply.status(201).send({ entry });
  });

  app.put("/admin/revenues/:id", auth, async (request) => {
    const { id } = request.params as { id: string };
    const b = request.body as {
      source?: string; type?: string; amountGbp?: number; notes?: string;
    };
    const entry = await prisma.revenueEntry.update({
      where: { id },
      data: {
        ...(b.source    !== undefined && { source:    b.source }),
        ...(b.type      !== undefined && { type:      b.type }),
        ...(b.amountGbp !== undefined && { amountGbp: b.amountGbp }),
        ...(b.notes     !== undefined && { notes:     b.notes }),
      },
    });
    return { entry };
  });

  app.delete("/admin/revenues/:id", auth, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.revenueEntry.delete({ where: { id } });
    return { ok: true };
  });

  // ── Financial summary (P&L by month, last 12 months) ──────────────────────

  app.get("/admin/financial-summary", auth, async () => {
    const now = new Date();
    const months: Array<{ month: number; year: number; label: string }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push({
        month: d.getUTCMonth() + 1,
        year:  d.getUTCFullYear(),
        label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
      });
    }

    const [allCosts, allRevenues] = await Promise.all([
      prisma.costEntry.findMany({
        where: { OR: months.map(m => ({ month: m.month, year: m.year })) },
      }),
      prisma.revenueEntry.findMany({
        where: { OR: months.map(m => ({ month: m.month, year: m.year })) },
      }),
    ]);

    const summary = months.map(({ month, year, label }) => {
      const costs    = allCosts   .filter(c => c.month === month && c.year === year);
      const revenues = allRevenues.filter(r => r.month === month && r.year === year);
      const totalCost    = costs.reduce((s, c) => s + c.monthlyCostGbp, 0);
      const totalRevenue = revenues.reduce((s, r) => s + r.amountGbp, 0);
      return { label, month, year, totalCost, totalRevenue, profit: totalRevenue - totalCost };
    });

    const cumulativeProfit = summary.reduce((s, m) => s + m.profit, 0);
    return { summary, cumulativeProfit };
  });

  // ── Marketing metrics ──────────────────────────────────────────────────────

  app.get("/admin/marketing-metrics", auth, async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      rendersByStyle,
      projectsByRoomType,
      clicksByProduct,
      clicksByRetailer,
      rendersLast30,
    ] = await Promise.all([
      // Style distribution by render count
      prisma.project.groupBy({
        by: ["designStyle"],
        _count: { _all: true },
        where: { designStyle: { not: null } },
        orderBy: { _count: { designStyle: "desc" } },
      }),
      // Room type distribution
      prisma.project.groupBy({
        by: ["roomType"],
        _count: { _all: true },
        where: { roomType: { not: null } },
        orderBy: { _count: { roomType: "desc" } },
      }),
      // Top clicked products
      prisma.productClick.groupBy({
        by: ["productId", "productName", "retailer"],
        _count: { _all: true },
        orderBy: { _count: { productId: "desc" } },
        take: 20,
      }),
      // Clicks by retailer
      prisma.productClick.groupBy({
        by: ["retailer"],
        _count: { _all: true },
        orderBy: { _count: { retailer: "desc" } },
      }),
      // Daily render counts for last 30 days
      prisma.render.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
        select: { createdAt: true },
      }),
    ]);

    const totalStyleRenders = rendersByStyle.reduce((s, r) => s + r._count._all, 0);
    const totalRoomProjects = projectsByRoomType.reduce((s, r) => s + r._count._all, 0);

    return {
      styleDistribution: rendersByStyle.map(r => ({
        style: r.designStyle,
        count: r._count._all,
        pct:   totalStyleRenders > 0 ? Math.round(r._count._all / totalStyleRenders * 100) : 0,
      })),
      roomTypeDistribution: projectsByRoomType.map(r => ({
        roomType: r.roomType,
        count:    r._count._all,
        pct:      totalRoomProjects > 0 ? Math.round(r._count._all / totalRoomProjects * 100) : 0,
      })),
      topProducts: clicksByProduct.map(c => ({
        productId:   c.productId,
        productName: c.productName,
        retailer:    c.retailer,
        clicks:      c._count._all,
      })),
      retailerClicks: clicksByRetailer.map(c => ({
        retailer: c.retailer,
        clicks:   c._count._all,
      })),
      renderTrend: groupByDay(rendersLast30.map(r => r.createdAt)),
    };
  });

  // ── Client metrics ─────────────────────────────────────────────────────────

  app.get("/admin/client-metrics", auth, async () => {
    const now = new Date();
    const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const freeLimit     = parseInt(process.env.FREE_RENDERS_PER_MONTH ?? "3");

    const [
      totalUsers,
      newUsersThisMonth,
      usersWithProject,
      signupsLast30,
      allUsersWithStats,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.project.groupBy({ by: ["userId"], _count: { _all: true } }),
      prisma.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.user.findMany({
        select: {
          id: true, email: true, createdAt: true,
          projects: {
            select: {
              renders: {
                where: { deletedAt: null },
                select: { id: true, createdAt: true },
              },
            },
          },
        },
      }),
    ]);

    // Build per-user stats
    const userStats = allUsersWithStats.map(u => {
      const renders = u.projects.flatMap(p => p.renders);
      const renderCount = renders.length;
      const lastRender  = renders.reduce((max, r) =>
        r.createdAt > max ? r.createdAt : max, new Date(0));
      return { ...u, renderCount, lastRender };
    });

    // Funnel
    const usersWhoRendered   = userStats.filter(u => u.renderCount > 0);
    const usersWithProjectSet = new Set(usersWithProject.map(u => u.userId));
    const usersWhoMadeProject = userStats.filter(u => usersWithProjectSet.has(u.id));

    const totalClicks = await prisma.productClick.count();
    const usersWhoClicked = await prisma.productClick.groupBy({
      by: ["userId"],
      where: { userId: { not: null } },
    });

    // Active this month
    const activeThisMonth = userStats.filter(u =>
      u.projects.flatMap(p => p.renders).some(r => r.createdAt >= startOfMonth)
    ).length;

    // Re-engaged: registered > 7 days ago, rendered in last 7 days
    const reEngaged = userStats.filter(u =>
      u.createdAt < sevenDaysAgo &&
      u.projects.flatMap(p => p.renders).some(r => r.createdAt >= sevenDaysAgo)
    ).length;

    // Near limit (80%+) and at limit
    const startOfUtcMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const usersAtOrNearLimit = userStats.map(u => {
      const rendersThisMonth = u.projects
        .flatMap(p => p.renders)
        .filter(r => r.createdAt >= startOfUtcMonth).length;
      return { ...u, rendersThisMonth };
    });
    const nearLimit = usersAtOrNearLimit.filter(u => u.rendersThisMonth >= freeLimit * 0.8 && u.rendersThisMonth < freeLimit).length;
    const atLimit   = usersAtOrNearLimit.filter(u => u.rendersThisMonth >= freeLimit).length;

    // Top 10 users
    const top10 = userStats
      .sort((a, b) => b.renderCount - a.renderCount)
      .slice(0, 10)
      .map((u, i) => ({
        rank: i + 1,
        email: u.email.replace(/(?<=.{2}).(?=.*@)/g, "*"),  // partial anonymize
        renderCount: u.renderCount,
        joinedDaysAgo: Math.floor((now.getTime() - u.createdAt.getTime()) / 86400000),
      }));

    const totalRenders = userStats.reduce((s, u) => s + u.renderCount, 0);
    const avgRendersPerUser = totalUsers > 0 ? Math.round(totalRenders / totalUsers * 10) / 10 : 0;

    return {
      metrics: {
        totalUsers,
        newUsersThisMonth,
        activeThisMonth,
        totalRenders,
        avgRendersPerUser,
        reEngaged,
      },
      funnel: [
        { stage: "Registered",        count: totalUsers },
        { stage: "Created a project", count: usersWhoMadeProject.length },
        { stage: "Generated a render",count: usersWhoRendered.length },
        { stage: "Clicked a product", count: usersWhoClicked.length + (totalClicks > 0 && usersWhoClicked.length === 0 ? totalClicks : 0) },
      ],
      limitMonitor: { freeLimit, nearLimit, atLimit },
      top10,
      registrationTrend: groupByDay(signupsLast30.map(u => u.createdAt)),
    };
  });

  // ── Product click tracking (public endpoint, auth optional) ───────────────

  app.post("/products/:id/click", async (request, reply) => {
    const { id } = request.params as { id: string };
    const b = request.body as { productName?: string; retailer?: string } | undefined;

    // Try to get userId from JWT if present — don't fail if absent
    let userId: string | null = null;
    try {
      await request.jwtVerify();
      userId = (request.user as { sub: string }).sub;
    } catch { /* unauthenticated click — record anyway */ }

    const product = await prisma.product.findUnique({
      where: { id },
      select: { title: true, retailer: true, productUrl: true, affiliateUrl: true },
    });

    if (!product) return reply.status(404).send({ error: "Not found" });

    await prisma.productClick.create({
      data: {
        productId:   id,
        productName: b?.productName ?? product.title,
        retailer:    b?.retailer    ?? product.retailer,
        userId,
      },
    });

    return { url: product.affiliateUrl ?? product.productUrl };
  });
}
