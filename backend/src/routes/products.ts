import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const querySchema = z.object({
  q: z.string().optional(),
  retailer: z.string().optional(),
  retailers: z.string().optional(), // comma-separated list of retailer IDs
  category: z.string().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(30),
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

      const items = await prisma.product.findMany({
        where,
        take: q.limit,
        orderBy: { title: "asc" },
      });

      return {
        items: items.map((p) => ({
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
        })),
      };
    }
  );
}
