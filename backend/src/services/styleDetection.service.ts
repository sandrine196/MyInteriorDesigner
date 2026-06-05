import { prisma } from "../lib/prisma.js";

// ── Keyword map ───────────────────────────────────────────────────────────────
// Keys MUST match the style IDs in DESIGN_STYLES on the frontend.

const STYLE_KEYWORDS: Record<string, string[]> = {
  scandi: [
    "scandi", "scandinavian", "nordic", "danish", "swedish", "norwegian",
    "hygge", "light oak", "pine", "birch", "natural wood", "clean lines",
    "functional", "understated", "pale wood", "whitewashed",
  ],
  industrial: [
    "industrial", "metal frame", "steel", "iron", "cast iron", "raw",
    "reclaimed", "factory", "loft", "dark metal", "black frame",
    "pipe", "scaffold", "riveted", "copper",
  ],
  traditional: [
    "traditional", "classic", "heritage", "chesterfield", "button back",
    "button tufted", "button-tufted", "mahogany", "dark wood", "wingback",
    "wing back", "roll arm", "georgian", "victorian", "edwardian",
    "ornate", "carved", "antique", "country", "rustic", "farmhouse",
    "cottage", "distressed", "painted wood",
  ],
  midcentury: [
    "mid-century", "mid century", "midcentury", "retro", "vintage",
    "walnut", "teak", "rosewood", "tapered leg", "splayed leg",
    "hairpin", "atomic", "50s", "60s", "70s", "eames",
  ],
  bohemian: [
    "bohemian", "boho", "eclectic", "macrame", "colourful",
    "moroccan", "ethnic", "tribal", "mixed patterns", "maximalist",
    "patchwork", "fringed",
  ],
  contemporary: [
    "contemporary", "modern", "sleek", "geometric", "angular",
    "streamlined", "monochrome", "minimalist", "polished",
    "sophisticated", "designer", "high gloss", "lacquered",
  ],
  japandi: [
    "japandi", "japanese", "zen", "wabi-sabi", "bamboo", "calm",
    "organic", "handcrafted", "serene", "washi", "shoji",
  ],
  coastal: [
    "coastal", "nautical", "beach", "seaside", "rattan", "wicker",
    "driftwood", "bleached", "rope", "jute", "linen", "seagrass",
  ],
};

// ── Pure text detection ───────────────────────────────────────────────────────

export function detectStylesFromText(title: string, description = ""): string[] {
  const text = `${title} ${description}`.toLowerCase();
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

  return top.length > 0 ? top : ["contemporary"];
}

// ── Bulk assignment ───────────────────────────────────────────────────────────

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
