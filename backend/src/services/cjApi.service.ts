import { prisma } from "../lib/prisma.js";

const CJ_API_URL = "https://ads.api.cj.com/query";

// ── CJ API types ──────────────────────────────────────────────────────────────

interface CJProduct {
  advertiserId:   string;
  advertiserName: string;
  title:          string;
  description:    string;
  price:          number;
  salePrice?:     number;
  currency:       string;
  imageUrl:       string;
  buyUrl:         string;
  category:       string;
  inStock:        boolean;
  sku:            string;
  brand?:         string;
}

interface CJSearchResponse {
  data: {
    shoppingProducts: {
      totalCount: number;
      resultList: CJProduct[];
    };
  };
  errors?: Array<{ message: string }>;
}

// ── Category mapping ──────────────────────────────────────────────────────────
// Maps to the exact category strings used in ROOM_CATEGORIES in projects.ts

function mapCategory(cjCategory: string, title: string): string {
  const t = title.toLowerCase();
  const c = cjCategory.toLowerCase();

  if (t.match(/\bsofa\b|\bsofas\b|\bsectional\b|\bcouch\b/)) return "sofa";
  if (t.match(/\barmchair\b|\barmchairs\b|\boccasional chair\b|\baccent chair\b/)) return "armchair";
  if (t.match(/\bcoffee table\b|\bcoffee tables\b/)) return "coffee_table";
  if (t.match(/\bside table\b|\bend table\b|\blamp table\b/)) return "side_table";
  if (t.match(/\btv unit\b|\btv stand\b|\bmedia unit\b|\bmedia console\b|\bentertainment unit\b/)) return "tv_unit";
  if (t.match(/\bdining table\b|\bdining tables\b|\beating table\b/)) return "dining_table";
  if (t.match(/\bdining chair\b|\bdining chairs\b|\beating chair\b/)) return "dining_chair";
  if (t.match(/\bsideboard\b|\bsideboards\b|\bbuffet\b/)) return "sideboard";
  if (t.match(/\bbed frame\b|\bbed frames\b|\bdivan\b|\bsleigh bed\b/) || (t.includes("bed") && !t.includes("bedside") && !t.includes("bedroom"))) return "bed";
  if (t.match(/\bwardrobe\b|\bwardrobes\b/)) return "wardrobe";
  if (t.match(/\bbedside\b|\bnight stand\b|\bnightstand\b|\bbedside table\b/)) return "bedside_table";
  if (t.match(/\bchest of drawers\b|\bchest of drawer\b|\bdresser\b|\bdrawers\b/)) return "chest_of_drawers";
  if (t.match(/\bdesk\b|\bdesks\b|\bwriting table\b/)) return "desk";
  if (t.match(/\boffice chair\b|\bdesk chair\b/)) return "office_chair";
  if (t.match(/\bbookcase\b|\bbookcases\b|\bbookshelf\b|\bbookshelves\b/)) return "bookcase";
  if (t.match(/\blamp\b|\blamps\b|\bpendant\b|\bfloor light\b|\btable light\b|\bchandelier\b|\bwalllight\b|\bwall light\b/)) return "lighting";
  if (t.match(/\brug\b|\brugs\b|\bcarpet\b|\bcarpets\b/)) return "rug";
  if (t.match(/\bmirror\b|\bmirrors\b/)) return "mirror";

  // Broad CJ category fallback
  if (c.includes("sofa") || c.includes("sectional")) return "sofa";
  if (c.includes("chair") && !c.includes("dining") && !c.includes("office")) return "armchair";
  if (c.includes("coffee") || c.includes("side table")) return "coffee_table";
  if (c.includes("dining")) return "dining_table";
  if (c.includes("bed") && !c.includes("bedside") && !c.includes("bedroom")) return "bed";
  if (c.includes("wardrobe") || c.includes("storage")) return "wardrobe";
  if (c.includes("desk") || c.includes("office")) return "desk";
  if (c.includes("lighting") || c.includes("lamp")) return "lighting";

  return "other";
}

// ── Dimension extraction ──────────────────────────────────────────────────────
// Returns mm values to match the Product schema (widthMm/depthMm/heightMm).

function extractDimensions(description: string, title: string): {
  widthMm:      number | null;
  depthMm:      number | null;
  heightMm:     number | null;
  dimensionsRaw: string | null;
} {
  const text = `${title} ${description}`;

  // W × D × H in cm (most common for UK furniture sites)
  const cmWDH = text.match(/W[\s:]?(\d+\.?\d*)\s*[×xX]\s*D[\s:]?(\d+\.?\d*)\s*[×xX]\s*H[\s:]?(\d+\.?\d*)\s*cm/i);
  if (cmWDH) {
    return {
      widthMm:       Math.round(parseFloat(cmWDH[1]) * 10),
      depthMm:       Math.round(parseFloat(cmWDH[2]) * 10),
      heightMm:      Math.round(parseFloat(cmWDH[3]) * 10),
      dimensionsRaw: cmWDH[0],
    };
  }

  // Generic W × D × H cm without labels
  const cmGeneric = text.match(/(\d+\.?\d*)\s*[×xX]\s*(\d+\.?\d*)\s*[×xX]\s*(\d+\.?\d*)\s*cm/i);
  if (cmGeneric) {
    return {
      widthMm:       Math.round(parseFloat(cmGeneric[1]) * 10),
      depthMm:       Math.round(parseFloat(cmGeneric[2]) * 10),
      heightMm:      Math.round(parseFloat(cmGeneric[3]) * 10),
      dimensionsRaw: cmGeneric[0],
    };
  }

  // W × D × H in mm
  const mmWDH = text.match(/(\d+)\s*[×xX]\s*(\d+)\s*[×xX]\s*(\d+)\s*mm/i);
  if (mmWDH) {
    return {
      widthMm:       parseInt(mmWDH[1]),
      depthMm:       parseInt(mmWDH[2]),
      heightMm:      parseInt(mmWDH[3]),
      dimensionsRaw: mmWDH[0],
    };
  }

  return { widthMm: null, depthMm: null, heightMm: null, dimensionsRaw: null };
}

// ── CJ GraphQL fetch ──────────────────────────────────────────────────────────

async function fetchCJProducts(
  advertiserIds: string[],
  limit  = 100,
  offset = 0,
): Promise<{ totalCount: number; resultList: CJProduct[] }> {
  const cid    = process.env.CJ_CID;
  const apiKey = process.env.CJ_API_KEY;

  if (!cid || !apiKey) {
    throw new Error("CJ_CID or CJ_API_KEY environment variable is not set");
  }

  const query = `{
    shoppingProducts(
      companyId: "${cid}"
      advertiserIds: ${JSON.stringify(advertiserIds)}
      partnerStatus: JOINED
      limit: ${limit}
      offset: ${offset}
    ) {
      totalCount
      resultList {
        advertiserId
        advertiserName
        title
        description
        price
        salePrice
        currency
        imageUrl
        buyUrl
        category
        inStock
        sku
        brand
      }
    }
  }`;

  console.log(`[CJ] POST ${CJ_API_URL} — CID:${cid} advertisers:${advertiserIds.join(",")}`);

  const res = await fetch(CJ_API_URL, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept:         "application/json",
    },
    body: JSON.stringify({ query }),
  });

  console.log(`[CJ] Response: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    console.error(`[CJ] Error body: ${body}`);
    throw new Error(`CJ API HTTP error: ${res.status} ${res.statusText} — ${body}`);
  }

  const json = await res.json() as CJSearchResponse;

  if (json.errors?.length) {
    console.error("[CJ] GraphQL errors:", JSON.stringify(json.errors));
    throw new Error(`CJ GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }

  const result = json.data?.shoppingProducts;
  if (!result) {
    console.error("[CJ] Unexpected response shape:", JSON.stringify(json).slice(0, 500));
    throw new Error("CJ API returned unexpected response shape — check logs");
  }

  return result;
}

// ── Affiliate URL validation ──────────────────────────────────────────────────

function isValidAffiliateUrl(url: string): boolean {
  // CJ uses several domains for tracking links
  const cjDomains = ["cj.com", "anrdoezrs.net", "dpbolvw.net", "tkqlhce.net", "kqzyfj.com", "jdoqocy.com", "qksrv.net"];
  return cjDomains.some((d) => url.includes(d));
}

// ── Main import function ──────────────────────────────────────────────────────

export interface ImportResult {
  imported:       number;
  updated:        number;
  skipped:        number;
  total:          number;
  withDimensions: number;
}

export async function importRaftProducts(): Promise<ImportResult> {
  const advertiserId = process.env.CJ_RAFT_ADVERTISER_ID;
  if (!advertiserId) throw new Error("CJ_RAFT_ADVERTISER_ID is not set");

  console.log("[CJ] Starting Raft Furniture import — advertiser:", advertiserId);

  let imported = 0, updated = 0, skipped = 0, withDimensions = 0;
  let offset = 0;
  const limit = 100;
  let totalCount = 0;

  do {
    console.log(`[CJ] Fetching products ${offset}–${offset + limit}…`);
    const result = await fetchCJProducts([advertiserId], limit, offset);
    totalCount = result.totalCount;

    console.log(`[CJ] Batch ${offset}–${offset + limit}: ${result.resultList.length} of ${totalCount} total`);

    for (const p of result.resultList) {
      try {
        // Validate affiliate URL — log but don't skip
        if (!isValidAffiliateUrl(p.buyUrl)) {
          console.warn(`[CJ] Unusual buyUrl format for "${p.title}": ${p.buyUrl}`);
        }

        const category = mapCategory(p.category, p.title);
        const dims     = extractDimensions(p.description, p.title);
        if (dims.widthMm) withDimensions++;

        const priceGbp    = p.salePrice ?? p.price;
        const externalId  = p.sku || `cj-${p.buyUrl.slice(-32)}`;

        const existing = await prisma.product.findUnique({
          where: { retailer_externalId: { retailer: "raft", externalId } },
          select: { id: true },
        });

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              priceGbp,
              inStock:      p.inStock,
              // Always refresh the affiliate URL — it may have new tracking params
              affiliateUrl: p.buyUrl,
              productUrl:   p.buyUrl,
              ...(dims.widthMm ? {
                widthMm:       dims.widthMm,
                depthMm:       dims.depthMm,
                heightMm:      dims.heightMm,
                dimensionsRaw: dims.dimensionsRaw,
              } : {}),
            },
          });
          updated++;
        } else {
          await prisma.product.create({
            data: {
              retailer:      "raft",
              externalId,
              title:         p.title,
              description:   p.description || null,
              imageUrl:      p.imageUrl,
              productUrl:    p.buyUrl,
              affiliateUrl:  p.buyUrl,
              priceGbp,
              category,
              sku:           p.sku || null,
              brand:         p.brand || "Raft",
              inStock:       p.inStock,
              source:        "cj_api",
              widthMm:       dims.widthMm,
              depthMm:       dims.depthMm,
              heightMm:      dims.heightMm,
              dimensionsRaw: dims.dimensionsRaw,
            },
          });
          imported++;
        }
      } catch (err) {
        console.error(`[CJ] Failed to import "${p.title}":`, err instanceof Error ? err.message : err);
        skipped++;
      }
    }

    offset += limit;

    if (offset < totalCount) {
      // Be respectful of CJ rate limits
      await new Promise((r) => setTimeout(r, 300));
    }
  } while (offset < totalCount);

  console.log(`[CJ] Import complete — total:${totalCount} imported:${imported} updated:${updated} skipped:${skipped} withDims:${withDimensions}`);

  return { imported, updated, skipped, total: totalCount, withDimensions };
}

// ── Source stats (for admin dashboard) ───────────────────────────────────────

export async function getRaftSourceStats() {
  const [total, inStock, withDims, byCategory, lastProduct] = await Promise.all([
    prisma.product.count({ where: { retailer: "raft" } }),
    prisma.product.count({ where: { retailer: "raft", inStock: true } }),
    prisma.product.count({ where: { retailer: "raft", widthMm: { not: null } } }),
    prisma.product.groupBy({
      by: ["category"],
      where: { retailer: "raft" },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
    }),
    prisma.product.findFirst({
      where: { retailer: "raft" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return {
    retailer:       "raft",
    label:          "Raft Furniture",
    via:            "CJ Affiliate",
    total,
    inStock,
    withDimensions: withDims,
    byCategory:     Object.fromEntries(byCategory.map((r) => [r.category ?? "uncategorised", r._count._all])),
    lastSyncAt:     lastProduct?.updatedAt?.toISOString() ?? null,
    configured:     !!(process.env.CJ_API_KEY && process.env.CJ_CID && process.env.CJ_RAFT_ADVERTISER_ID),
  };
}
