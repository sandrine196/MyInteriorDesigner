import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { checkFurnitureFit, fitSortOrder } from "../services/fitChecker.service.js";

const querySchema = z.object({
  q: z.string().optional(),
  retailer: z.string().optional(),
  retailers: z.string().optional(), // comma-separated list of retailer IDs
  category: z.string().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(30),
  projectId: z.string().optional(), // when provided, attach furniture fit data
});

function parseStyleTags(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export async function productRoutes(app: FastifyInstance) {
  app.get(
    "/products",
    { preHandler: [app.authenticate] },
    async (request) => {
      const q = querySchema.parse(request.query);

      const where: {
        OR?: Array<{ title: { contains: string } } | { dimensionsRaw: { contains: string } }>;
        retailer?: string | { in: string[] };
        category?: string;
        priceGbp?: { lte: number };
      } = {};

      // Retailer filter — prefer comma-separated `retailers` over single `retailer`
      if (q.retailers) {
        const list = q.retailers.split(",").map((s) => s.trim()).filter(Boolean);
        if (list.length > 0) where.retailer = { in: list };
      } else if (q.retailer) {
        where.retailer = q.retailer;
      }

      if (q.category) where.category = q.category;

      if (q.maxPrice != null) {
        where.priceGbp = { lte: q.maxPrice };
      }

      if (q.q) {
        const term = q.q.trim();
        if (term.length > 0) {
          where.OR = [
            { title: { contains: term } },
            { dimensionsRaw: { contains: term } },
          ];
        }
      }

      // Look up room dimensions for fit checking (only if projectId provided and user owns it)
      let roomLengthMm: number | null = null;
      let roomWidthMm: number | null = null;
      if (q.projectId) {
        const u = request.user as { sub: string };
        const project = await prisma.project.findFirst({
          where: { id: q.projectId, userId: u.sub },
          select: { roomLengthMm: true, roomWidthMm: true },
        });
        if (project) {
          roomLengthMm = project.roomLengthMm;
          roomWidthMm = project.roomWidthMm;
        }
      }

      const hasDimensions = !!roomLengthMm && !!roomWidthMm;

      const rawItems = await prisma.product.findMany({
        where,
        take: hasDimensions ? 100 : q.limit, // fetch more so we can sort by fit
        orderBy: { title: "asc" },
      });

      const mapped = rawItems.map((p) => {
        const fitResult = hasDimensions
          ? checkFurnitureFit(roomLengthMm!, roomWidthMm!, p)
          : null;
        return {
          id: p.id,
          retailer: p.retailer,
          title: p.title,
          imageUrl: p.imageUrl,
          productUrl: p.productUrl,
          affiliateUrl: p.affiliateUrl,
          widthMm: p.widthMm,
          depthMm: p.depthMm,
          heightMm: p.heightMm,
          dimensionsRaw: p.dimensionsRaw,
          priceGbp: p.priceGbp,
          category: p.category,
          styleTags: parseStyleTags(p.styleTags),
          fitResult,
        };
      });

      // Sort: perfect → tight → too_large, then by price within each group
      if (hasDimensions) {
        mapped.sort((a, b) => {
          const fitA = fitSortOrder(a.fitResult!.fits);
          const fitB = fitSortOrder(b.fitResult!.fits);
          if (fitA !== fitB) return fitA - fitB;
          return (a.priceGbp ?? 9999) - (b.priceGbp ?? 9999);
        });
      }

      return { items: mapped.slice(0, q.limit) };
    }
  );
}
