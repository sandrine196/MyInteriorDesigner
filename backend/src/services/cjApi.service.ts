import { prisma } from "../lib/prisma.js";
import { assignMissingStyles } from "./styleDetection.service.js";

const CJ_API_URL = "https://ads.api.cj.com/query";

// ── CJ API types ──────────────────────────────────────────────────────────────

interface CJPrice {
  amount:   number | string;  // API returns a string e.g. "197.00"
  currency: string;
}

interface CJProduct {
  id:             string;
  title:          string;
  description:    string;
  brand?:         string;
  price:          CJPrice;
  salePrice?:     CJPrice | null;
  imageLink:      string;
  link:           string;  // affiliate tracking URL
  advertiserId:   string;
  advertiserName: string;
}

interface CJSearchResponse {
  data?: {
    shoppingProducts: {
      totalCount: number;
      resultList: CJProduct[];
    };
  };
  errors?: Array<{ message: string }>;
}

// ── Category mapping ──────────────────────────────────────────────────────────
// Title-only matching — CJ doesn't return a category field we can rely on yet.

function mapCategory(title: string): string {
  const t = title.toLowerCase();

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

  const query = `
    query SearchRaftProducts {
      shoppingProducts(
        companyId: "${cid}"
        partnerIds: ${JSON.stringify(advertiserIds)}
        limit: ${limit}
        offset: ${offset}
      ) {
        totalCount
        resultList {
          id
          title
          description
          brand
          price {
            amount
            currency
          }
          salePrice {
            amount
            currency
          }
          imageLink
          link
          advertiserId
          advertiserName
        }
      }
    }
  `;

  console.log(`[CJ] POST ${CJ_API_URL} — CID:${cid} partnerIds:${advertiserIds.join(",")}`);

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

  // Log first product on the first page so we can verify the field mapping
  if (offset === 0 && result.resultList.length > 0) {
    console.log("[CJ] First product sample:", JSON.stringify(result.resultList[0]));
  }

  return result;
}

// ── Affiliate URL construction ────────────────────────────────────────────────

function buildAffiliateUrl(productUrl: string, cid: string, advertiserId: string): string {
  // CJ standard deep-link format: dpbolvw.net/click-{publisherId}-{advertiserId}?url={encodedUrl}
  return `https://www.dpbolvw.net/click-${cid}-${advertiserId}?url=${encodeURIComponent(productUrl)}`;
}

// ── Main import function ──────────────────────────────────────────────────────

export interface ImportResult {
  imported:       number;
  updated:        number;
  skipped:        number;
  total:          number;
  withDimensions: number;
  stylesAssigned: number;
  firstError?:    string;
}

export async function importRaftProducts(): Promise<ImportResult> {
  const advertiserId = process.env.CJ_RAFT_ADVERTISER_ID;
  const cid          = process.env.CJ_CID;
  if (!advertiserId) throw new Error("CJ_RAFT_ADVERTISER_ID is not set");
  if (!cid)          throw new Error("CJ_CID is not set");

  console.log("[CJ] Starting Raft Furniture import — partnerId:", advertiserId);

  let imported = 0, updated = 0, skipped = 0, withDimensions = 0;
  let firstError: string | undefined;
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
        const affiliateUrl = buildAffiliateUrl(p.link, cid, advertiserId);

        const category   = mapCategory(p.title);
        const dims       = extractDimensions(p.description ?? "", p.title);
        if (dims.widthMm) withDimensions++;

        const priceGbp   = parseFloat(String(p.salePrice?.amount ?? p.price.amount));
        const externalId = p.id;  // CJ product ID — stable unique key

        const existing = await prisma.product.findUnique({
          where: { retailer_externalId: { retailer: "raft", externalId } },
          select: { id: true },
        });

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              priceGbp,
              affiliateUrl,
              productUrl: p.link,
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
              imageUrl:      p.imageLink,
              productUrl:    p.link,
              affiliateUrl,
              priceGbp,
              category,
              brand:         p.brand || p.advertiserName || "Raft",
              inStock:       true,  // no inStock field in API yet — default true
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
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[CJ] Failed to import "${p.title}": ${msg}`);
        if (!firstError) firstError = `"${p.title}": ${msg}`;
        skipped++;
      }
    }

    offset += limit;

    if (offset < totalCount) {
      await new Promise((r) => setTimeout(r, 300));
    }
  } while (offset < totalCount);

  console.log(`[CJ] Import complete — total:${totalCount} imported:${imported} updated:${updated} skipped:${skipped} withDims:${withDimensions}`);

  const { processed: stylesAssigned } = await assignMissingStyles();

  return { imported, updated, skipped, total: totalCount, withDimensions, stylesAssigned, firstError };
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
