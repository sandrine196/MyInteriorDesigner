import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { backupDatabase, listBackups, restoreDatabase, getBackupStats } from "../scripts/backup.js";
import { Resend } from "resend";
import { config } from "../config/index.js";
import { importRaftProducts, getRaftSourceStats, mapToRoomCategory } from "../services/cjApi.service.js";
import { assignMissingStyles } from "../services/styleDetection.service.js";
import { getAllCosts } from "../services/costs.service.js";
import { storage } from "../services/storage.service.js";

const COST_PER_RENDER_GBP = 0.03;
const PRO_PRICE_GBP = 9.99;

type GeoInfo = { country: string; countryCode: string; city: string } | null;

function normaliseIp(ip: string): string {
  // Strip IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 → 1.2.3.4)
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

async function geoLookup(ips: (string | null)[]): Promise<Map<string, GeoInfo>> {
  // Normalise and deduplicate, keyed by original IP so callers can look up by stored value
  const normMap = new Map<string, string>(); // original → normalised
  for (const ip of ips) {
    if (!ip) continue;
    const norm = normaliseIp(ip);
    if (!isPrivateIp(norm)) normMap.set(ip, norm);
  }
  const result = new Map<string, GeoInfo>();
  if (normMap.size === 0) return result;
  const uniqueNorm = [...new Set(normMap.values())];
  try {
    const res = await fetch("http://ip-api.com/batch?fields=status,country,countryCode,city,query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uniqueNorm.map(q => ({ query: q }))),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return result;
    const rows = await res.json() as Array<{ status: string; query: string; country?: string; countryCode?: string; city?: string }>;
    const byNorm = new Map<string, GeoInfo>();
    for (const row of rows) {
      if (row.status === "success") {
        byNorm.set(row.query, { country: row.country ?? "", countryCode: row.countryCode ?? "", city: row.city ?? "" });
      }
    }
    // Map back to original IPs
    for (const [orig, norm] of normMap) {
      const geo = byNorm.get(norm);
      if (geo) result.set(orig, geo);
    }
  } catch {
    // geo is best-effort — don't fail the request
  }
  return result;
}

function parseRetailers(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

/** Build a day-by-day count array for the given window, oldest first. */
function groupByDay(dates: Date[], days: number): Array<{ date: string; count: number }> {
  const result: Array<{ date: string; count: number }> = [];
  const now = new Date();
  const n = days > 0 ? days : 30;
  for (let i = n - 1; i >= 0; i--) {
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

/** Anonymise email: keep first char + domain, mask the rest. */
function anonEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  return `${local[0]}***@${domain}`;
}

/** Parse the ?range= query param into a cutoff Date or null (= all time). */
function parseRange(range?: string): Date | null {
  const now = new Date();
  switch (range) {
    case "7d":    return new Date(now.getTime() - 7  * 86400000);
    case "30d":   return new Date(now.getTime() - 30 * 86400000);
    case "month": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    default:      return null; // all time
  }
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
      unverifiedUsers,
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
      prisma.user.count({ where: { emailVerified: false } }),
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
      users: { total: totalUsers, free: freeUsers, pro: proUsers, unverified: unverifiedUsers },
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

      signupsPerDay: groupByDay(signupsLast30.map((u) => u.createdAt), 30),
      rendersPerDay: groupByDay(rendersLast30.map((r) => r.createdAt), 30),
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

  // ── GET /admin/live-costs ─────────────────────────────────────────────────
  // Real-time cost snapshot pulled from provider APIs + calculated from DB.

  app.get("/admin/live-costs", auth, async (request) => {
    const { period } = request.query as { period?: string };
    const p = (period === "week" || period === "today") ? period : "month";
    return getAllCosts(p);
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

  app.get("/admin/marketing-metrics", auth, async (request) => {
    const { range } = request.query as { range?: string };
    const cutoff = parseRange(range);
    const days   = range === "7d" ? 7 : range === "month" ? 31 : range === "all" ? 365 : 30;
    const dateFilter = cutoff ? { gte: cutoff } : undefined;

    const [
      rendersByStyle,
      projectsByRoomType,
      clicksByProduct,
      clicksByRetailer,
      renderDates,
    ] = await Promise.all([
      prisma.project.groupBy({
        by: ["designStyle"],
        _count: { _all: true },
        where: { designStyle: { not: null }, ...(dateFilter && { createdAt: dateFilter }) },
        orderBy: { _count: { designStyle: "desc" } },
      }),
      prisma.project.groupBy({
        by: ["roomType"],
        _count: { _all: true },
        where: { roomType: { not: null }, ...(dateFilter && { createdAt: dateFilter }) },
        orderBy: { _count: { roomType: "desc" } },
      }),
      prisma.productClick.groupBy({
        by: ["productId", "productName", "retailer"],
        _count: { _all: true },
        where: dateFilter ? { clickedAt: dateFilter } : undefined,
        orderBy: { _count: { productId: "desc" } },
        take: 20,
      }),
      prisma.productClick.groupBy({
        by: ["retailer"],
        _count: { _all: true },
        where: dateFilter ? { clickedAt: dateFilter } : undefined,
        orderBy: { _count: { retailer: "desc" } },
      }),
      prisma.render.findMany({
        where: { deletedAt: null, ...(dateFilter && { createdAt: dateFilter }) },
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
      renderTrend: groupByDay(renderDates.map(r => r.createdAt), days),
    };
  });

  // ── Redesign funnel metrics ────────────────────────────────────────────────

  app.get("/admin/redesign-metrics", auth, async (request) => {
    const { range } = request.query as { range?: string };
    const cutoff = parseRange(range);
    const dateFilter = cutoff ? { gte: cutoff } : undefined;
    const where = dateFilter ? { createdAt: dateFilter } : {};

    const EVENTS = [
      "redesign_started",
      "redesign_completed",
      "redesign_try_another_style",
      "redesign_signup_clicked",
      "redesign_limit_hit",
    ] as const;

    const [eventCounts, sessions, topStyles] = await Promise.all([
      // Count each funnel event
      Promise.all(EVENTS.map(eventType =>
        prisma.analyticsEvent.count({ where: { ...where, eventType } })
          .then(count => ({ eventType, count }))
      )),
      // Session stats
      prisma.redesignSession.aggregate({
        _count: { _all: true },
        _sum:   { fullRedesignsToday: true, restagesUsed: true },
      }),
      // Most-chosen styles
      prisma.analyticsEvent.groupBy({
        by: ["metadata"],
        where: { ...where, eventType: "redesign_started" },
        _count: { _all: true },
        orderBy: { _count: { metadata: "desc" } },
        take: 6,
      }),
    ]);

    const funnel = eventCounts.reduce((acc, { eventType, count }) => {
      acc[eventType] = count;
      return acc;
    }, {} as Record<string, number>);

    const completionRate = funnel.redesign_started > 0
      ? Math.round(funnel.redesign_completed / funnel.redesign_started * 100)
      : 0;
    const signupRate = funnel.redesign_completed > 0
      ? Math.round(funnel.redesign_signup_clicked / funnel.redesign_completed * 100)
      : 0;

    // Parse style from metadata JSON string
    const styleBreakdown = topStyles.flatMap(row => {
      try {
        const m = JSON.parse(row.metadata ?? "{}") as { style?: string };
        return m.style ? [{ style: m.style, count: row._count._all }] : [];
      } catch { return []; }
    }).reduce((acc: Record<string, number>, { style, count }) => {
      acc[style] = (acc[style] ?? 0) + count;
      return acc;
    }, {});

    return {
      funnel,
      completionRate,
      signupRate,
      totalSessions:    sessions._count._all,
      totalRedesigns:   sessions._sum.fullRedesignsToday ?? 0,
      totalRestages:    sessions._sum.restagesUsed ?? 0,
      styleBreakdown,
    };
  });

  // ── Client metrics ─────────────────────────────────────────────────────────

  app.get("/admin/client-metrics", auth, async (request) => {
    const { range } = request.query as { range?: string };
    const cutoff    = parseRange(range);
    const days      = range === "7d" ? 7 : range === "month" ? 31 : range === "all" ? 365 : 30;
    const dateFilter = cutoff ? { gte: cutoff } : undefined;

    const now           = new Date();
    const sevenDaysAgo  = new Date(now.getTime() - 7  * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const startOfMonth  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const freeLimit     = parseInt(process.env.FREE_RENDERS_PER_MONTH ?? "3");

    const [
      totalUsers,
      newUsersThisMonth,
      usersWithProject,
      signupDates,
      allUsersWithStats,
      usersWhoClicked,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.project.groupBy({ by: ["userId"], _count: { _all: true } }),
      prisma.user.findMany({
        where: { createdAt: dateFilter ?? {} },
        select: { createdAt: true },
      }),
      prisma.user.findMany({
        select: {
          id: true, email: true, tier: true, createdAt: true, lastLoginAt: true, emailVerified: true,
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
      prisma.productClick.groupBy({
        by: ["userId"],
        where: { userId: { not: null } },
      }),
    ]);

    const userStats = allUsersWithStats.map(u => {
      const renders = u.projects.flatMap(p => p.renders);
      return { ...u, renders, renderCount: renders.length };
    });

    const usersWithProjectSet = new Set(usersWithProject.map(u => u.userId));
    const usersWhoMadeProject = userStats.filter(u => usersWithProjectSet.has(u.id));
    const usersWhoRendered    = userStats.filter(u => u.renderCount > 0);

    const activeThisMonth = userStats.filter(u =>
      u.renders.some(r => r.createdAt >= startOfMonth),
    ).length;

    const reEngaged = userStats.filter(u =>
      u.createdAt < sevenDaysAgo &&
      u.renders.some(r => r.createdAt >= sevenDaysAgo),
    ).length;

    // Limit monitor — per user this month
    const usersThisMonth = userStats.map(u => ({
      ...u,
      rendersThisMonth: u.renders.filter(r => r.createdAt >= startOfMonth).length,
    }));
    const nearLimit = usersThisMonth.filter(u =>
      u.rendersThisMonth >= freeLimit * 0.8 && u.rendersThisMonth < freeLimit,
    ).length;
    const atLimit = usersThisMonth.filter(u =>
      u.rendersThisMonth >= freeLimit,
    ).length;

    // Limit monitor table — users at ≥50% usage this month, sorted by %
    const limitTable = usersThisMonth
      .filter(u => u.rendersThisMonth >= Math.ceil(freeLimit * 0.5))
      .sort((a, b) => b.rendersThisMonth - a.rendersThisMonth)
      .slice(0, 20)
      .map(u => ({
        email:       anonEmail(u.email),
        tier:        u.tier,
        renders:     u.rendersThisMonth,
        limit:       freeLimit,
        usagePct:    Math.round(u.rendersThisMonth / freeLimit * 100),
      }));

    // Return rates
    const returnRate7d  = totalUsers > 0
      ? Math.round(userStats.filter(u =>
          u.createdAt <= sevenDaysAgo &&
          u.renders.some(r => r.createdAt >= sevenDaysAgo),
        ).length / totalUsers * 100) : 0;
    const returnRate30d = totalUsers > 0
      ? Math.round(userStats.filter(u =>
          u.createdAt <= thirtyDaysAgo &&
          u.renders.some(r => r.createdAt >= thirtyDaysAgo),
        ).length / totalUsers * 100) : 0;

    // Click-through rate = users who clicked / users who rendered
    const clickThroughRate = usersWhoRendered.length > 0
      ? Math.round(usersWhoClicked.length / usersWhoRendered.length * 100) : 0;

    const unverifiedCount = userStats.filter(u => !u.emailVerified).length;

    // Top 10
    const top10 = [...userStats]
      .sort((a, b) => b.renderCount - a.renderCount)
      .slice(0, 10)
      .map((u, i) => ({
        rank: i + 1,
        email: anonEmail(u.email),
        renderCount: u.renderCount,
        joinedDaysAgo: Math.floor((now.getTime() - u.createdAt.getTime()) / 86400000),
        lastLoginDaysAgo: u.lastLoginAt
          ? Math.floor((now.getTime() - u.lastLoginAt.getTime()) / 86400000)
          : null,
        emailVerified: u.emailVerified,
      }));

    // Recent logins — last 20 users to log in
    const recentLogins = [...userStats]
      .filter(u => u.lastLoginAt != null)
      .sort((a, b) => b.lastLoginAt!.getTime() - a.lastLoginAt!.getTime())
      .slice(0, 20)
      .map(u => ({
        email: anonEmail(u.email),
        tier:  u.tier,
        lastLoginDaysAgo: Math.floor((now.getTime() - u.lastLoginAt!.getTime()) / 86400000),
        lastLoginAt: u.lastLoginAt!.toISOString(),
        renderCount: u.renderCount,
        emailVerified: u.emailVerified,
      }));

    const totalRenders      = userStats.reduce((s, u) => s + u.renderCount, 0);
    const avgRendersPerUser = totalUsers > 0 ? Math.round(totalRenders / totalUsers * 10) / 10 : 0;

    return {
      metrics: {
        totalUsers, newUsersThisMonth, activeThisMonth,
        totalRenders, avgRendersPerUser, reEngaged,
        returnRate7d, returnRate30d, clickThroughRate,
      },
      funnel: [
        { stage: "Registered",         count: totalUsers },
        { stage: "Created a project",  count: usersWhoMadeProject.length },
        { stage: "Generated a render", count: usersWhoRendered.length },
        { stage: "Clicked a product",  count: usersWhoClicked.length },
      ],
      limitMonitor: { freeLimit, nearLimit, atLimit },
      limitTable,
      top10,
      recentLogins,
      unverifiedCount,
      registrationTrend: groupByDay(signupDates.map(u => u.createdAt), days),
    };
  });

  // ── System: database stats ────────────────────────────────────────────────

  app.get("/admin/system/stats", auth, async () => {
    const [users, projects, renders, products, clicks, costs, revenues] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.render.count(),
      prisma.product.count(),
      prisma.productClick.count(),
      prisma.costEntry.count(),
      prisma.revenueEntry.count(),
    ]);
    return {
      tables: [
        { name: "Users",          count: users },
        { name: "Projects",       count: projects },
        { name: "Renders",        count: renders },
        { name: "Products",       count: products },
        { name: "ProductClicks",  count: clicks },
        { name: "CostEntries",    count: costs },
        { name: "RevenueEntries", count: revenues },
      ].sort((a, b) => b.count - a.count),
    };
  });

  // ── System: health check ───────────────────────────────────────────────────

  app.get("/admin/system/health", auth, async () => {
    const checks: Record<string, { status: string; responseMs?: number; detail?: string }> = {};

    // Database
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: "ok", responseMs: Date.now() - dbStart };
    } catch (e) {
      checks.database = { status: "error", detail: e instanceof Error ? e.message : "unknown" };
    }

    // R2 (try listing backup prefix)
    const r2Start = Date.now();
    try {
      const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId:     process.env.R2_ACCESS_KEY_ID ?? "",
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
        },
      });
      await client.send(new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME ?? "",
        Prefix: "database-backups/",
        MaxKeys: 1,
      }));
      checks.r2 = { status: "ok", responseMs: Date.now() - r2Start };
    } catch (e) {
      checks.r2 = { status: "error", detail: e instanceof Error ? e.message : "unknown" };
    }

    // Keys present (no live API call)
    checks.gemini  = { status: process.env.GEMINI_API_KEY  ? "ok" : "missing_key" };
    checks.resend  = { status: process.env.RESEND_API_KEY  ? "ok" : "missing_key" };
    checks.adminEmail = { status: process.env.ADMIN_EMAIL  ? "ok" : "missing_key" };

    const allOk = Object.values(checks).every(c => c.status === "ok");
    return { status: allOk ? "ok" : "degraded", checks, timestamp: new Date().toISOString() };
  });

  // ── Backups: list ──────────────────────────────────────────────────────────

  app.get("/admin/backups", auth, async () => {
    try {
      const backups = await listBackups();
      return { backups };
    } catch (e) {
      return { backups: [], error: e instanceof Error ? e.message : "Failed to list backups" };
    }
  });

  // ── Backups: manual trigger ────────────────────────────────────────────────

  let backupRunning = false;

  app.post("/admin/backups/run", auth, async (_req, reply) => {
    if (backupRunning) {
      return reply.status(409).send({ error: "A backup is already in progress" });
    }
    backupRunning = true;
    try {
      const result = await backupDatabase();
      return result;
    } finally {
      backupRunning = false;
    }
  });

  // ── Backups: stats ─────────────────────────────────────────────────────────

  app.get("/admin/backups/stats", auth, async () => {
    try {
      return await getBackupStats();
    } catch {
      return { totalBackups: 0, latestBackup: null, totalSizeMB: "0.00", nextScheduled: null, method: "prisma-json", storageLocation: null };
    }
  });

  // ── Backups: restore ────────────────────────────────────────────────────────

  app.post("/admin/backups/restore", auth, async (request, reply) => {
    const { backupKey, confirm } = request.body as { backupKey?: string; confirm?: string };
    if (confirm !== "RESTORE") {
      return reply.status(400).send({ error: 'Send confirm: "RESTORE" to proceed.' });
    }
    if (!backupKey?.startsWith("database-backups/")) {
      return reply.status(400).send({ error: "Invalid backup key" });
    }
    const result = await restoreDatabase(backupKey);
    return result;
  });

  // ── Test email (admin only — remove after debugging) ──────────────────────

  app.get("/admin/test-email", auth, async (_req, reply) => {
    const to      = process.env.ADMIN_EMAIL;
    const from    = config.email.from;
    const apiKey  = config.email.apiKey;
    const provider = config.email.provider;

    const info = { provider, hasApiKey: !!apiKey, from, to: to ?? "(ADMIN_EMAIL not set)" };

    if (!to) {
      return reply.status(400).send({ error: "ADMIN_EMAIL env var not set", info });
    }
    if (provider !== "resend" || !apiKey) {
      return reply.status(400).send({
        error: `Email not configured — provider is "${provider}", API key present: ${!!apiKey}`,
        info,
      });
    }

    try {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from,
        to,
        subject: "Test email — MyInteriorDesigner",
        html: "<p>Email system is working! ✅</p>",
      });
      return { ok: true, result, info };
    } catch (err) {
      const e = err as { message?: string; statusCode?: number };
      return reply.status(500).send({
        ok: false,
        error: e.message,
        code:  e.statusCode,
        info,
      });
    }
  });

  // ── CJ raw diagnostic — shows exactly what the CJ API returns ───────────
  app.get("/admin/products/cj-raw-test", auth, async (_req, reply) => {
    const cid          = process.env.CJ_CID;
    const apiKey       = process.env.CJ_API_KEY;
    const advertiserId = process.env.CJ_RAFT_ADVERTISER_ID;

    if (!cid || !apiKey || !advertiserId) {
      return reply.status(500).send({ error: "CJ env vars not set", cid: !!cid, apiKey: !!apiKey, advertiserId: !!advertiserId });
    }

    const query = `
      query RawTest {
        shoppingProducts(
          companyId: "${cid}"
          partnerIds: ${JSON.stringify([advertiserId])}
          limit: 3
          offset: 0
        ) {
          totalCount
          resultList {
            id
            title
            link
            imageLink
            price { amount currency }
            salePrice { amount currency }
            advertiserId
            advertiserName
          }
        }
      }
    `;

    const res = await fetch("https://ads.api.cj.com/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const json = await res.json() as Record<string, unknown>;
    return {
      httpStatus: res.status,
      cid,
      advertiserId,
      rawResponse: json,
    };
  });

  // ── Product sources ──────────────────────────────────────────────────────

  app.get("/admin/products/sources", auth, async () => {
    const stats = await getRaftSourceStats();
    return { sources: [stats] };
  });

  // Diagnostic: what does the live server's DB actually contain?
  app.get("/admin/products/db-check", auth, async () => {
    const [total, byRetailer] = await Promise.all([
      prisma.product.count(),
      prisma.product.groupBy({
        by: ["retailer", "source"],
        _count: { _all: true },
        orderBy: { _count: { retailer: "desc" } },
      }),
    ]);
    return {
      total,
      byRetailer,
      databaseUrl: process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":REDACTED@"),
    };
  });

  app.post("/admin/products/import/raft", auth, async (_req, reply) => {
    try {
      const result = await importRaftProducts();
      return { success: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      return reply.status(500).send({ success: false, error: message });
    }
  });

  app.post("/admin/products/assign-styles", auth, async (_req, reply) => {
    try {
      const result = await assignMissingStyles();
      return { success: true, ...result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Style assignment failed";
      return reply.status(500).send({ success: false, error: message });
    }
  });

  app.post("/admin/products/recategorise", auth, async (_req, reply) => {
    try {
      const products = await prisma.product.findMany({
        where: { retailer: "raft" },
        select: { id: true, title: true, description: true, category: true },
      });
      let processed = 0, skipped = 0;
      const byCategory: Record<string, number> = {};
      for (const p of products) {
        const newCategory = mapToRoomCategory(p.title, p.description ?? "");
        if (newCategory !== p.category) {
          await prisma.product.update({ where: { id: p.id }, data: { category: newCategory } });
          processed++;
        } else {
          skipped++;
        }
        byCategory[newCategory] = (byCategory[newCategory] ?? 0) + 1;
      }
      console.log(`[Recategorise] processed:${processed} skipped:${skipped}`);
      return { success: true, processed, skipped, byCategory };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Recategorisation failed";
      return reply.status(500).send({ success: false, error: message });
    }
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

  // ── GET /admin/users ─────────────────────────────────────────────────────
  app.get("/admin/users", auth, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, tier: true, suspended: true,
        emailVerified: true, createdAt: true, lastLoginAt: true, lastLoginIp: true,
        projects: {
          orderBy: { createdAt: "asc" },
          select: {
            name: true,
            roomType: true,
            _count: { select: { renders: { where: { deletedAt: null } } } },
            renders: {
              where: { deletedAt: null, imageKey: { not: null } },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { imageKey: true },
            },
          },
        },
      },
    });
    const geo = await geoLookup(users.map(u => u.lastLoginIp));
    return users.map(u => ({
      id:            u.id,
      email:         u.email,
      tier:          u.tier,
      suspended:     u.suspended,
      emailVerified: u.emailVerified,
      createdAt:     u.createdAt.toISOString(),
      lastLoginAt:   u.lastLoginAt?.toISOString() ?? null,
      lastLoginIp:   u.lastLoginIp ?? null,
      location:      u.lastLoginIp ? (geo.get(u.lastLoginIp) ?? null) : null,
      projectCount:  u.projects.length,
      projects:      u.projects.map(p => ({
        name:            p.name,
        roomType:        p.roomType ?? null,
        renderCount:     p._count.renders,
        latestRenderUrl: p.renders[0]?.imageKey ? storage.getUrl(p.renders[0].imageKey) : null,
      })),
    }));
  });

  // ── PATCH /admin/users/:id/suspend ───────────────────────────────────────
  app.patch("/admin/users/:id/suspend", auth, async (request, reply) => {
    const { id }        = request.params as { id: string };
    const { suspended } = request.body   as { suspended: boolean };
    const user = await prisma.user.update({
      where: { id },
      data:  { suspended },
      select: { id: true, suspended: true },
    });
    return user;
  });

  // ── DELETE /admin/users/:id ───────────────────────────────────────────────
  app.delete("/admin/users/:id", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({ where: { id }, select: { suspended: true } });
    if (!user) return reply.status(404).send({ error: "User not found" });
    if (!user.suspended) return reply.status(400).send({ error: "User must be suspended before deletion" });
    await prisma.user.delete({ where: { id } });
    return { ok: true };
  });

  // ── POST /admin/impersonate/user ──────────────────────────────────────────
  // Generate a 2-hour user session token for any account — admin testing only.
  app.post("/admin/impersonate/user", auth, async (request, reply) => {
    const { userId } = request.body as { userId?: string };
    if (!userId) return reply.status(400).send({ error: "userId required" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tier: true, isAdmin: true },
    });
    if (!user) return reply.status(404).send({ error: "User not found" });

    const token = app.jwt.sign(
      { sub: user.id, email: user.email, tier: user.tier, isAdmin: user.isAdmin },
      { expiresIn: "2h" }
    );
    return { token, email: user.email };
  });

  // ── POST /admin/impersonate/agent ─────────────────────────────────────────
  // Generate a 2-hour agent session token for any agent — admin testing only.
  app.post("/admin/impersonate/agent", auth, async (request, reply) => {
    const { agentId } = request.body as { agentId?: string };
    if (!agentId) return reply.status(400).send({ error: "agentId required" });

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, email: true, name: true, referralCode: true },
    });
    if (!agent) return reply.status(404).send({ error: "Agent not found" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (app.jwt.sign as any)(
      { type: "agent_session", agentId: agent.id, email: agent.email, referralCode: agent.referralCode },
      { expiresIn: "2h" }
    ) as string;

    return { token, email: agent.email, name: agent.name };
  });

  // ── GET /admin/impersonate/list ───────────────────────────────────────────
  // Returns users and agents for the impersonation panel.
  app.get("/admin/impersonate/list", auth, async () => {
    const [users, agents] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, email: true, tier: true, isAdmin: true, createdAt: true },
      }),
      prisma.agent.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, agencyName: true, email: true, status: true, referralCode: true },
      }),
    ]);
    return { users, agents };
  });
}
