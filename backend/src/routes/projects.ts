import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  countSuccessfulRendersThisMonth,
  countRendersToday,
  countRendersThisHour,
  countPendingRenders,
  countGlobalPendingRenders,
  countUserProjects,
  getLastRenderTimeForProject,
} from "../lib/usage.js";
import { checkSuspiciousActivity } from "../lib/alert.js";
import { track } from "../lib/analytics.js";
import { storage } from "../services/storage.service.js";
import { aiService } from "../services/ai.service.js";
import { emailService } from "../services/email.service.js";
import type { Env } from "../env.js";

const FLOOR_PLAN_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const VALID_ROOM_TYPES = [
  "living_room",
  "dining_room",
  "living_dining",
  "bedroom_primary",
  "bedroom_secondary",
  "home_office",
] as const;

const createBody = z.object({
  name: z.string().min(1).max(120),
  roomType: z.enum(VALID_ROOM_TYPES),
});

const setupBody = z.object({
  budgetMin: z.number().int().positive().nullable(),
  budgetMax: z.number().int().positive().nullable(),
  preferredRetailers: z.array(z.string()).default([]),
  designStyle: z.string().max(50).nullable(),
  wallColorPalette: z.string().max(100).nullable().default(null),
  flooringType: z.string().max(50).nullable().default(null),
});

const renderBody = z.object({
  prompt: z.string().min(1).max(4000),
  productIds: z.array(z.string()).max(12).default([]),
});

const patchDimensionsBody = z.object({
  roomLengthMm: z.number().int().positive().max(100_000_000),
  roomWidthMm: z.number().int().positive().max(100_000_000),
  ceilingHeightMm: z.number().int().positive().max(100_000_000),
});

function toImageUrl(imageKey: string | null): string | null {
  if (!imageKey) return null;
  if (imageKey.startsWith("http")) return imageKey; // external/legacy URLs pass through
  return storage.getUrl(imageKey);
}

function parseRetailers(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

const ROOM_CATEGORIES: Record<string, string[]> = {
  living_room:       ["sofa", "sofas", "armchair", "armchairs", "coffee_table", "side_table", "tv_unit", "lighting"],
  living_dining:     ["sofa", "sofas", "armchair", "armchairs", "coffee_table", "dining_table", "dining_chair", "dining_chairs", "lighting"],
  dining_room:       ["dining_table", "dining_chair", "dining_chairs", "lighting"],
  bedroom_primary:   ["bed", "beds", "wardrobe", "wardrobes", "bedside_table", "lighting"],
  bedroom_secondary: ["bed", "beds", "wardrobe", "wardrobes", "bedside_table", "chest_of_drawers", "lighting"],
  home_office:       ["desk", "office_chair", "bookcase", "shelving", "lighting"],
};

async function autoSelectProducts(project: {
  roomType: string | null;
  preferredRetailers: string | null;
  budgetMax: number | null;
  designStyle: string | null;
}) {
  const retailers = parseRetailers(project.preferredRetailers);
  const where: Record<string, unknown> = {};
  if (retailers.length > 0) where.retailer = { in: retailers };
  if (project.budgetMax != null) {
    where.priceGbp = { lte: Math.max(Math.round(project.budgetMax * 0.4), 500) };
  }

  const candidates = await prisma.product.findMany({ where, take: 100, orderBy: { title: "asc" } });

  // Prefer products matching the design style, fall back to all if none match
  let pool = candidates;
  if (project.designStyle) {
    const styled = candidates.filter((p) => {
      try { return (JSON.parse(p.styleTags ?? "[]") as string[]).includes(project.designStyle!); }
      catch { return false; }
    });
    if (styled.length > 0) pool = styled;
  }

  // Pick one per category using the explicit room type
  const roomKey = project.roomType ?? "living_room";
  const categoryPriority = ROOM_CATEGORIES[roomKey] ?? ROOM_CATEGORIES["living_room"];

  const byCategory = new Map<string, typeof pool>();
  for (const p of pool) {
    if (p.category) {
      if (!byCategory.has(p.category)) byCategory.set(p.category, []);
      byCategory.get(p.category)!.push(p);
    }
  }
  const picked: typeof pool = [];
  for (const cat of categoryPriority) {
    const options = byCategory.get(cat);
    if (options?.length) picked.push(options[Math.floor(Math.random() * options.length)]);
  }
  return picked;
}

function serializeProject(p: Record<string, unknown>) {
  const renders = Array.isArray(p.renders)
    ? (p.renders as Array<Record<string, unknown>>).map((r) => {
        const { productsSnapshot, ...rest } = r;
        return {
          ...rest,
          imageUrl: toImageUrl(r.imageKey as string | null),
          products: (() => {
            try { return JSON.parse((productsSnapshot as string | null) ?? "[]"); }
            catch { return []; }
          })(),
        };
      })
    : p.renders;
  return {
    ...p,
    preferredRetailers: parseRetailers(p.preferredRetailers as string | null),
    renders,
    floorPlanUrl: toImageUrl(p.floorPlanKey as string | null),
  };
}

export async function projectRoutes(app: FastifyInstance, env: Env) {

  // ── Create project ────────────────────────────────────────────────────────

  app.post(
    "/projects",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const u = request.user as { sub: string; tier: string };
      const body = createBody.parse(request.body);

      const projectCount = await countUserProjects(u.sub);
      const projectLimit = u.tier === "pro" ? env.MAX_PROJECTS_PRO : env.MAX_PROJECTS_FREE;
      if (projectCount >= projectLimit) {
        return reply.status(403).send({
          error: `Project limit reached (${projectLimit} for ${u.tier} tier)`,
          code: "PROJECT_LIMIT",
          limit: projectLimit,
        });
      }

      const project = await prisma.project.create({
        data: { userId: u.sub, name: body.name, roomType: body.roomType },
      });
      track("project_created", u.sub, { projectId: project.id, roomType: body.roomType });
      return { project: serializeProject(project) };
    }
  );

  // ── List projects ─────────────────────────────────────────────────────────

  app.get(
    "/projects",
    { preHandler: [app.authenticate] },
    async (request) => {
      const u = request.user as { sub: string };
      const projects = await prisma.project.findMany({
        where: { userId: u.sub },
        orderBy: { createdAt: "desc" },
        include: { renders: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 } },
      });
      return { projects: projects.map(serializeProject) };
    }
  );

  // ── Get project ───────────────────────────────────────────────────────────

  app.get(
    "/projects/:projectId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const { projectId } = request.params as { projectId: string };
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: u.sub },
        include: { renders: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 } },
      });
      if (!project) return reply.status(404).send({ error: "Project not found" });
      return { project: serializeProject(project) };
    }
  );

  // ── Update room dimensions ────────────────────────────────────────────────

  app.patch(
    "/projects/:projectId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parsed = patchDimensionsBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid room dimensions" });
      }
      const body = parsed.data;
      const u = request.user as { sub: string };
      const { projectId } = request.params as { projectId: string };
      const existing = await prisma.project.findFirst({
        where: { id: projectId, userId: u.sub },
      });
      if (!existing) return reply.status(404).send({ error: "Project not found" });
      const project = await prisma.project.update({
        where: { id: projectId },
        data: {
          roomLengthMm: body.roomLengthMm,
          roomWidthMm: body.roomWidthMm,
          ceilingHeightMm: body.ceilingHeightMm,
        },
        include: { renders: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 } },
      });
      return { project: serializeProject(project) };
    }
  );

  // ── Project setup ─────────────────────────────────────────────────────────

  app.patch(
    "/projects/:projectId/setup",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const { projectId } = request.params as { projectId: string };

      const parsed = setupBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid setup data" });
      }
      const body = parsed.data;

      const existing = await prisma.project.findFirst({
        where: { id: projectId, userId: u.sub },
      });
      if (!existing) return reply.status(404).send({ error: "Project not found" });

      const project = await prisma.project.update({
        where: { id: projectId },
        data: {
          budgetMin: body.budgetMin,
          budgetMax: body.budgetMax,
          preferredRetailers: JSON.stringify(body.preferredRetailers),
          designStyle: body.designStyle,
          wallColorPalette: body.wallColorPalette,
          flooringType: body.flooringType,
        },
        include: { renders: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 } },
      });

      return { project: serializeProject(project) };
    }
  );

  // ── Save room features ───────────────────────────────────────────────────

  app.patch(
    "/projects/:projectId/features",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const { projectId } = request.params as { projectId: string };
      const body = request.body as { roomFeatures: unknown };
      if (!body?.roomFeatures || typeof body.roomFeatures !== "object") {
        return reply.status(400).send({ error: "roomFeatures is required" });
      }
      const existing = await prisma.project.findFirst({ where: { id: projectId, userId: u.sub } });
      if (!existing) return reply.status(404).send({ error: "Project not found" });
      const project = await prisma.project.update({
        where: { id: projectId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { roomFeatures: body.roomFeatures as any },
        include: { renders: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 } },
      });
      return { project: serializeProject(project) };
    }
  );

  // ── Delete project ────────────────────────────────────────────────────────

  app.delete(
    "/projects/:projectId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const { projectId } = request.params as { projectId: string };
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: u.sub },
        include: { renders: true },
      });
      if (!project) return reply.status(404).send({ error: "Project not found" });

      // Clean up stored files
      for (const render of project.renders) {
        if (render.imageKey && !render.imageKey.startsWith("http")) {
          await storage.delete(render.imageKey).catch(() => {});
        }
      }
      if (project.floorPlanKey) {
        await storage.delete(project.floorPlanKey).catch(() => {});
      }

      await prisma.project.delete({ where: { id: projectId } });
      return { ok: true };
    }
  );

  // ── Upload floor plan ─────────────────────────────────────────────────────

  app.post(
    "/projects/:projectId/floor-plan",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const { projectId } = request.params as { projectId: string };
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: u.sub },
      });
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "Missing file" });

      if (!data.mimetype.startsWith("image/")) {
        return reply.status(400).send({ error: "Floor plan must be an image file (JPEG, PNG, or WebP)" });
      }

      const buffer = await data.toBuffer();
      if (buffer.length > FLOOR_PLAN_MAX_BYTES) {
        return reply.status(413).send({ error: "Floor plan must be under 5 MB" });
      }

      const webpBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();

      const newKey = `floor-plans/${projectId}.webp`;
      if (project.floorPlanKey && project.floorPlanKey !== newKey) {
        await storage.delete(project.floorPlanKey).catch(() => {});
      }

      await storage.upload(newKey, webpBuffer, "image/webp");

      await prisma.project.update({
        where: { id: projectId },
        data: { floorPlanKey: newKey },
      });

      // Return both the key (for state update) and the resolved URL (for direct display)
      return { floorPlanKey: newKey, floorPlanUrl: storage.getUrl(newKey) };
    }
  );

  // ── Create render ─────────────────────────────────────────────────────────

  app.post(
    "/projects/:projectId/renders",
    {
      preHandler: [app.authenticate],
      config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      const u = request.user as { sub: string; tier: string };
      const { projectId } = request.params as { projectId: string };
      const body = renderBody.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { id: u.sub },
        select: { email: true, suspended: true, marketingConsent: true },
      });
      if (user?.suspended) {
        return reply.status(403).send({
          error: "Your account has been suspended. Please contact support.",
          code: "SUSPENDED",
        });
      }

      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: u.sub },
      });
      if (!project) return reply.status(404).send({ error: "Project not found" });

      const missingDims: string[] = [];
      if (project.roomLengthMm == null) missingDims.push("roomLengthMm");
      if (project.roomWidthMm == null) missingDims.push("roomWidthMm");
      if (project.ceilingHeightMm == null) missingDims.push("ceilingHeightMm");
      if (missingDims.length > 0) {
        return reply.status(400).send({
          error: "Set room length, width, and ceiling height before generating a render.",
          code: "MISSING_ROOM_DIMENSIONS",
          missing: missingDims,
        });
      }

      // ── Rate limit: global concurrent render cap ──────────────────────────
      const globalPending = await countGlobalPendingRenders();
      if (globalPending >= env.MAX_CONCURRENT_RENDERS) {
        return reply.status(503).send({
          error: "Render queue is full. Please try again in a moment.",
          code: "QUEUE_FULL",
        });
      }

      // ── Rate limit: 1 render in progress per user ─────────────────────────
      const pendingCount = await countPendingRenders(u.sub);
      if (pendingCount > 0) {
        return reply.status(429).send({
          error: "A render is already in progress. Wait for it to finish.",
          code: "RENDER_IN_PROGRESS",
        });
      }

      // ── Rate limit: 30-second cooldown per project ────────────────────────
      const lastRenderAt = await getLastRenderTimeForProject(projectId);
      if (lastRenderAt) {
        const elapsedMs = Date.now() - lastRenderAt.getTime();
        const cooldownMs = env.RENDER_COOLDOWN_SECONDS * 1000;
        if (elapsedMs < cooldownMs) {
          const retryAfter = Math.ceil((cooldownMs - elapsedMs) / 1000);
          reply.header("Retry-After", String(retryAfter));
          return reply.status(429).send({
            error: `Please wait ${retryAfter}s before starting another render for this project.`,
            code: "COOLDOWN",
            retryAfter,
          });
        }
      }

      // ── Rate limit: hourly cap (all users) ────────────────────────────────
      const rendersThisHour = await countRendersThisHour(u.sub);
      if (rendersThisHour >= env.MAX_RENDERS_PER_HOUR) {
        return reply.status(429).send({
          error: `Hourly render limit reached (${env.MAX_RENDERS_PER_HOUR}/hour). Try again later.`,
          code: "HOURLY_LIMIT",
          limit: env.MAX_RENDERS_PER_HOUR,
        });
      }

      // ── Suspicious activity check ─────────────────────────────────────────
      const rendersToday = await countRendersToday(u.sub);
      const wasSuspended = await checkSuspiciousActivity(
        u.sub,
        user?.email ?? u.sub,
        rendersToday,
        env
      );
      if (wasSuspended) {
        return reply.status(429).send({
          error: "Account suspended due to unusual activity. Please contact support.",
          code: "AUTO_SUSPENDED",
        });
      }

      // ── Tier-specific limits ──────────────────────────────────────────────
      if (u.tier === "free") {
        const usedThisMonth = await countSuccessfulRendersThisMonth(u.sub);
        if (usedThisMonth >= env.FREE_RENDERS_PER_MONTH) {
          return reply.status(402).send({
            error: "Free render limit reached for this month",
            code: "FREE_LIMIT",
            limit: env.FREE_RENDERS_PER_MONTH,
          });
        }
      } else {
        if (rendersToday >= env.PRO_RENDERS_PER_DAY) {
          return reply.status(429).send({
            error: `Daily render limit reached (${env.PRO_RENDERS_PER_DAY}/day). Resets at midnight UTC.`,
            code: "DAILY_LIMIT",
            limit: env.PRO_RENDERS_PER_DAY,
          });
        }
      }

      // ── Resolve products (manual selection or AI auto-pick) ───────────────
      let products: Awaited<ReturnType<typeof prisma.product.findMany>>;
      if (body.productIds.length === 0) {
        products = await autoSelectProducts(project);
      } else {
        products = await prisma.product.findMany({ where: { id: { in: body.productIds } } });
        if (products.length !== body.productIds.length) {
          return reply.status(400).send({ error: "One or more product IDs are invalid" });
        }
      }

      // ── Generate render ───────────────────────────────────────────────────
      const productsSnapshot = JSON.stringify(
        products.map((p) => ({
          id: p.id,
          title: p.title,
          retailer: p.retailer,
          priceGbp: p.priceGbp ?? null,
          imageUrl: p.imageUrl,
          productUrl: p.productUrl,
          affiliateUrl: p.affiliateUrl ?? null,
        }))
      );

      const render = await prisma.render.create({
        data: { projectId, prompt: body.prompt, status: "pending", productsSnapshot },
      });
      track("render_created", u.sub, { renderId: render.id, projectId });

      try {
        const { buffer, mock } = await aiService.generateRoomImage({
          userPrompt:       body.prompt,
          floorPlanKey:     project.floorPlanKey,
          projectName:      project.name,
          designStyle:      project.designStyle,
          wallColorPalette: project.wallColorPalette,
          flooringType:     project.flooringType,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          roomFeatures:     (project.roomFeatures as any) ?? null,
          products: products.map((p) => ({
            title:         p.title,
            retailer:      p.retailer,
            priceGbp:      p.priceGbp,
            category:      p.category,
            styleTags:     (() => { try { return JSON.parse(p.styleTags ?? "[]") as string[]; } catch { return []; } })(),
            widthMm:       p.widthMm,
            depthMm:       p.depthMm,
            heightMm:      p.heightMm,
            dimensionsRaw: p.dimensionsRaw,
          })),
          room: {
            length:        project.roomLengthMm!,
            width:         project.roomWidthMm!,
            ceilingHeight: project.ceilingHeightMm!,
          },
        });

        const imageKey = `renders/${render.id}.png`;
        await storage.upload(imageKey, buffer);

        await prisma.render.update({
          where: { id: render.id },
          data: {
            status: "done",
            imageKey,
            errorMessage: mock ? "No AI key configured; placeholder image returned." : null,
          },
        });
        track("render_completed", u.sub, { renderId: render.id, status: "done" });

        // Fire notification emails without blocking the response
        if (user?.email) {
          void emailService.sendRenderReady(user.email, project.name, projectId);

          if (u.tier === "free" && user.marketingConsent) {
            const usedAfter = await countSuccessfulRendersThisMonth(u.sub);
            if (usedAfter === env.FREE_RENDERS_PER_MONTH - 1) {
              void emailService.sendUsageWarning(user.email, usedAfter, env.FREE_RENDERS_PER_MONTH);
            }
          }
        }

        return { render: { id: render.id, status: "done", imageUrl: storage.getUrl(imageKey), mock } };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Render failed";
        await prisma.render.update({
          where: { id: render.id },
          data: { status: "failed", errorMessage: message },
        });
        track("render_completed", u.sub, { renderId: render.id, status: "failed" });
        return reply.status(500).send({ error: message });
      }
    }
  );

  // ── Delete render ─────────────────────────────────────────────────────────

  app.delete(
    "/projects/:projectId/renders/:renderId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const { projectId, renderId } = request.params as { projectId: string; renderId: string };
      const render = await prisma.render.findFirst({
        where: { id: renderId, projectId, project: { userId: u.sub }, deletedAt: null },
      });
      if (!render) return reply.status(404).send({ error: "Not found" });
      await prisma.render.update({ where: { id: render.id }, data: { deletedAt: new Date() } });
      if (render.imageKey && !render.imageKey.startsWith("http")) {
        await storage.delete(render.imageKey).catch(() => {});
      }
      return { ok: true };
    }
  );

  // ── Get render ────────────────────────────────────────────────────────────

  app.get(
    "/projects/:projectId/renders/:renderId",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const u = request.user as { sub: string };
      const { projectId, renderId } = request.params as { projectId: string; renderId: string };
      const render = await prisma.render.findFirst({
        where: { id: renderId, projectId, project: { userId: u.sub }, deletedAt: null },
      });
      if (!render) return reply.status(404).send({ error: "Not found" });
      return {
        render: {
          id: render.id,
          status: render.status,
          prompt: render.prompt,
          imageUrl: toImageUrl(render.imageKey),
          errorMessage: render.errorMessage,
        },
      };
    }
  );
}
