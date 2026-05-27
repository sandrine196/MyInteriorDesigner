export interface FitResult {
  fits: "perfect" | "tight" | "too_large" | "unknown";
  clearanceCm: number;
  message: string;
  recommendation: string;
}

// Categories that map to living-room fit logic
const LIVING_CATS = new Set(["sofa", "sofas", "armchair", "armchairs", "coffee_table", "side_table", "tv_unit"]);
// Categories that map to bedroom fit logic
const BEDROOM_CATS = new Set(["bed", "beds", "wardrobe", "wardrobes", "bedside_table"]);
// Categories that map to dining fit logic
const DINING_CATS = new Set(["dining_table", "dining_chair", "dining_chairs"]);

function noData(): FitResult {
  return { fits: "unknown", clearanceCm: 0, message: "Dimensions unavailable", recommendation: "Check dimensions before purchasing" };
}

export function checkFurnitureFit(
  roomLengthMm: number,
  roomWidthMm: number,
  product: { widthMm: number | null; depthMm: number | null; heightMm: number | null; category: string | null }
): FitResult {
  const cat = (product.category ?? "").toLowerCase();
  const widthMm = product.widthMm;
  const depthMm = product.depthMm;

  if (!widthMm) return noData();

  const roomLCm = roomLengthMm / 10;
  const roomWCm = roomWidthMm / 10;
  const itemWCm = widthMm / 10;
  // Depth fallback: 50% of width is a reasonable estimate for most upholstered/case goods
  // when the retailer omits depth. Dining tables are typically 40–50% as deep as they are wide.
  const itemDCm = depthMm ? depthMm / 10 : itemWCm * 0.5;

  // ── Bedroom items ────────────────────────────────────────────────────────────
  if (BEDROOM_CATS.has(cat)) {
    const shortSide = Math.min(roomLCm, roomWCm);
    const clearanceEach = (shortSide - itemWCm) / 2;
    if (clearanceEach >= 80) {
      return { fits: "perfect", clearanceCm: Math.round(clearanceEach), message: `${Math.round(clearanceEach)}cm clearance each side`, recommendation: "Ideal for this room" };
    } else if (clearanceEach >= 50) {
      return { fits: "tight", clearanceCm: Math.round(clearanceEach), message: `Tight — only ${Math.round(clearanceEach)}cm each side`, recommendation: "Will fit but feels cosy" };
    } else if (clearanceEach > 0) {
      return { fits: "too_large", clearanceCm: Math.round(clearanceEach), message: `Very tight — ${Math.round(clearanceEach)}cm each side`, recommendation: "Consider a smaller size" };
    }
    return { fits: "too_large", clearanceCm: 0, message: "Too wide for this room", recommendation: "This won't fit comfortably" };
  }

  // ── Dining items ─────────────────────────────────────────────────────────────
  if (DINING_CATS.has(cat)) {
    const neededL = itemWCm + 180; // 90cm each end for chairs
    const neededW = itemDCm + 180; // 90cm each side
    const fitsL = neededL <= roomLCm && neededW <= roomWCm;
    const fitsLSwapped = neededL <= roomWCm && neededW <= roomLCm;
    const tableFits = itemWCm <= roomLCm && itemDCm <= roomWCm;
    const tableFitsSwapped = itemWCm <= roomWCm && itemDCm <= roomLCm;

    if (fitsL || fitsLSwapped) {
      const slack = Math.round(Math.min(
        fitsL ? roomLCm - neededL : roomWCm - neededL,
        fitsL ? roomWCm - neededW : roomLCm - neededW,
      ));
      return { fits: "perfect", clearanceCm: slack, message: "Fits with 90cm chair space all round", recommendation: "Ideal for this dining room" };
    } else if (tableFits || tableFitsSwapped) {
      return { fits: "tight", clearanceCm: 60, message: "Table fits but chairs will be tight", recommendation: "Consider a smaller table" };
    }
    return { fits: "too_large", clearanceCm: 0, message: "Too large for this room", recommendation: "This table won't fit comfortably" };
  }

  // ── Living room items ────────────────────────────────────────────────────────
  if (LIVING_CATS.has(cat)) {
    const longestWall = Math.max(roomLCm, roomWCm);
    const remaining = longestWall - itemWCm;

    // For sofas also check depth doesn't eat too much floor space
    const shortSide = Math.min(roomLCm, roomWCm);
    const depthOk = itemDCm <= shortSide * 0.45; // sofa shouldn't dominate the narrow dimension

    if (remaining >= 200 && depthOk) {
      return { fits: "perfect", clearanceCm: Math.round(remaining), message: `Great fit — ${Math.round(remaining)}cm remaining`, recommendation: "Perfect for this room" };
    } else if (remaining >= 100 && depthOk) {
      return { fits: "tight", clearanceCm: Math.round(remaining), message: `Fits with ${Math.round(remaining)}cm to spare`, recommendation: "Will work in this room" };
    } else if (remaining >= 0) {
      return { fits: "too_large", clearanceCm: Math.round(remaining), message: `Very tight — only ${Math.round(remaining)}cm remaining`, recommendation: cat.includes("sofa") ? "Consider a 2-seater instead" : "Consider a smaller option" };
    }
    return { fits: "too_large", clearanceCm: 0, message: "Too wide for this room", recommendation: "This won't fit" };
  }

  // ── Storage / lighting / other ───────────────────────────────────────────────
  const longestWall = Math.max(roomLCm, roomWCm);
  const remaining = longestWall - itemWCm;
  if (remaining >= 150) return { fits: "perfect", clearanceCm: Math.round(remaining), message: "Should fit comfortably", recommendation: "Good choice for this room size" };
  if (remaining >= 50) return { fits: "tight", clearanceCm: Math.round(remaining), message: "Fits with limited space", recommendation: "Measure carefully before ordering" };
  return { fits: "too_large", clearanceCm: 0, message: "May be too large", recommendation: "Check dimensions carefully" };
}

export function fitSortOrder(fit: FitResult["fits"]): number {
  return { perfect: 0, tight: 1, too_large: 2, unknown: 3 }[fit];
}
