import { prisma } from "../lib/prisma.js";

// ── Keyword map ───────────────────────────────────────────────────────────────
// Keys MUST match the style IDs in DESIGN_STYLES / BEDROOM_STYLES on the
// frontend (web/src/app/(app)/projects/[id]/page.tsx). Bathroom/kitchen
// styles are excluded — those rooms use no product catalogue (inspiration
// renders only), so Raft/CJ furniture never needs those tags.

const STYLE_KEYWORDS: Record<string, string[]> = {
  // ── Living room / general ──────────────────────────────────────────────
  modern_heritage: [
    "heritage", "crown molding", "cornice", "picture rail", "panelled",
    "wainscot", "classic detail", "traditional silhouette", "updated classic",
  ],
  warm_minimalism: [
    "boucle", "bouclé", "biscuit", "clay", "warm cream", "low-profile",
    "modular sofa", "organic shape", "rounded edge", "soft modern", "putty",
  ],
  midcentury: [
    "mid-century", "mid century", "midcentury", "retro", "vintage",
    "walnut", "teak", "rosewood", "tapered leg", "splayed leg",
    "hairpin", "atomic", "50s", "60s", "70s", "eames",
  ],
  biophilic: [
    "biophilic", "organic modern", "raw wood", "light oak", "natural stone",
    "woven bamboo", "rattan blind", "greenery", "plant stand", "nature-inspired",
  ],
  english_cottage: [
    "cottage", "slipcover", "floral", "vintage print", "gilded frame",
    "layered pattern", "mixed wood", "english country", "botanical print",
  ],
  curated_maximalism: [
    "maximalist", "bold pattern", "jewel tone", "midnight blue", "plum",
    "antique", "eclectic", "statement piece", "rich colour",
  ],
  japandi: [
    "japandi", "japanese", "zen", "wabi-sabi", "bamboo", "calm",
    "organic", "handcrafted", "serene", "washi", "shoji",
  ],
  earthy_rustic: [
    "rustic", "exposed brick", "ceiling beam", "distressed leather",
    "terracotta", "rust", "raw texture", "reclaimed wood", "farmhouse",
  ],
  regencycore: [
    "regency", "gold filigree", "pleated", "roll-arm", "roll arm",
    "elaborate wallpaper", "romantic", "estate luxury", "ornate", "carved",
  ],
  hollywood_cottage: [
    "hollywood", "glamorous", "lacquer", "lacquered", "velvet", "cinematic",
    "vintage glam", "high gloss",
  ],
  // ── Bedroom ─────────────────────────────────────────────────────────────
  bed_quiet_luxury: [
    "quiet luxury", "hotel suite", "upholstered headboard", "taupe",
    "greige", "mushroom", "custom lighting", "plush rug",
  ],
  bed_scandi_cottage: [
    "scandi", "scandinavian", "nordic", "platform bed", "heritage floral",
    "linen bedding", "light wood bed", "hygge",
  ],
  bed_earthy_bohemian: [
    "bohemian", "boho", "rattan headboard", "macrame", "macramé",
    "woven wall hanging", "persian rug", "sage", "ochre", "moroccan",
  ],
  bed_romantic_regency: [
    "canopy", "sheer drape", "tufted velvet", "floral wallcovering",
    "antique gold", "romantic bedroom", "four poster",
  ],
  bed_soft_modern: [
    "floating bed", "low profile bed", "architectural line", "curated minimal",
    "soft modern", "minimalist bedroom",
  ],
  bed_atmospheric: [
    "dark moody", "forest green", "dark plum", "charcoal", "ambient lighting",
    "atmospheric", "deep colour",
  ],
  bed_coastal_calm: [
    "coastal", "nautical", "beach", "seaside", "sand and sky", "jute",
    "washed wood", "linen curtain", "driftwood",
  ],
  bed_urban_loft: [
    "iron bed frame", "exposed brick", "soft industrial", "down comforter",
    "knit throw", "industrial", "metal frame", "raw",
  ],
  bed_midcentury_retro: [
    "walnut dresser", "nightstand", "geometric pillow", "retro lighting",
    "mid-century bedroom", "tapered leg", "teak",
  ],
  bed_biophilic: [
    "air-purifying", "organic mattress", "smart lighting", "olive",
    "sage green", "biophilic", "natural fibre", "plant",
  ],
};

const DEFAULT_STYLE = "warm_minimalism";

// ── HTML stripping ────────────────────────────────────────────────────────────

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ").replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// ── Pure text detection ───────────────────────────────────────────────────────

export function detectStylesFromText(title: string, description = ""): string[] {
  const text = `${title} ${stripHtml(description)}`.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) {
        score += kw.includes(" ") ? 2 : 1;  // phrase match scores higher
      }
    }
    if (score > 0) scores[style] = score;
  }

  const top = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([style]) => style);

  return top.length > 0 ? top : [DEFAULT_STYLE];
}

// ── Force retag all products for a specific retailer ─────────────────────────

export async function retagRetailer(retailer: string): Promise<{
  processed: number;
  byStyle:   Record<string, number>;
}> {
  const products = await prisma.product.findMany({
    where:  { retailer },
    select: { id: true, title: true, description: true },
  });

  console.log(`[StyleDetection] Force-retagging ${products.length} ${retailer} products`);

  let processed = 0;
  const byStyle: Record<string, number> = {};

  for (const p of products) {
    const styles = detectStylesFromText(p.title, p.description ?? "");
    await prisma.product.update({ where: { id: p.id }, data: { styleTags: JSON.stringify(styles) } });
    for (const s of styles) byStyle[s] = (byStyle[s] ?? 0) + 1;
    processed++;
  }

  console.log(`[StyleDetection] Retagged ${processed} products`);
  return { processed, byStyle };
}

// ── Bulk assignment (untagged only) ──────────────────────────────────────────

export async function assignMissingStyles(): Promise<{
  processed: number;
  skipped:   number;
  byStyle:   Record<string, number>;
}> {
  // Only process products with no style tags yet
  const untagged = await prisma.product.findMany({
    where: { OR: [{ styleTags: null }, { styleTags: "[]" }] },
    select: { id: true, title: true, description: true },
  });

  console.log(`[StyleDetection] ${untagged.length} untagged products to process`);

  let processed = 0, skipped = 0;
  const byStyle: Record<string, number> = {};

  for (const p of untagged) {
    try {
      const styles = detectStylesFromText(p.title, p.description ?? "");
      await prisma.product.update({
        where: { id: p.id },
        data:  { styleTags: JSON.stringify(styles) },
      });
      for (const s of styles) byStyle[s] = (byStyle[s] ?? 0) + 1;
      processed++;
    } catch (err) {
      console.error(`[StyleDetection] Failed on "${p.title}":`, err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  console.log(`[StyleDetection] Done — processed:${processed} skipped:${skipped}`);
  return { processed, skipped, byStyle };
}
