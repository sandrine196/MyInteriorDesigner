import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { analyzeRoomSpatially } from "../services/spatialReasoning.service.js";
import type { FloorPlanAnalysis } from "../services/floorPlanAnalysis.service.js";

export const RENDER_WIDTH = 1024;
export const RENDER_HEIGHT = 768;

export type ProductForPrompt = {
  title: string;
  retailer: string;
  priceGbp: number | null;
  category: string | null;
  styleTags: string[];
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  dimensionsRaw: string | null;
  description: string | null;
};

export type RoomDimensionsMm = {
  length: number;
  width: number;
  ceilingHeight: number;
};

export async function placeholderBuffer(): Promise<Buffer> {
  const onePx = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  return sharp(onePx).resize(RENDER_WIDTH, RENDER_HEIGHT, { fit: "cover" }).png().toBuffer();
}

const WALL_COLOR_DESCRIPTIONS: Record<string, string> = {
  pale:    "pale, light and airy walls",
  cold:    "cool-toned walls (grays, blues)",
  warm:    "warm-toned walls (beiges, creams, terracotta)",
  vivid:   "bold, vivid colored walls",
  neutral: "neutral walls (white, off-white)",
};

const FLOORING_DESCRIPTIONS: Record<string, string> = {
  pale_wood: "pale wood flooring (light oak, birch)",
  dark_wood: "dark wood flooring (walnut, mahogany)",
  warm_oak:  "warm oak flooring (medium honey tones)",
  carpet:    "carpet flooring",
  tiles:     "tile flooring (ceramic, stone)",
};

const DESIGN_STYLE_LABELS: Record<string, string> = {
  scandi:         "Scandi Minimalist",
  industrial:     "Modern Industrial",
  traditional:    "Cosy Traditional",
  midcentury:     "Mid-Century Modern",
  bohemian:       "Bohemian",
  contemporary:   "Contemporary Luxe",
  japandi:        "Japandi",
  coastal:        "Coastal",
  // Virtual-staging extended styles
  art_deco:       "Art Deco",
  farmhouse:      "Modern Farmhouse",
  maximalist:     "Maximalist",
  period:         "Period / Georgian",
  french_country: "French Country",
  biophilic:      "Biophilic / Nature-Forward",
  new_build:      "Contemporary New Build",
};

// ── Room features types (mirrors frontend api.ts) ─────────────────────────────

type WallRole = "entrance" | "far" | "left" | "right";

interface DoorFeature {
  type: "door";
  subtype: "single" | "double" | "sliding" | "bifold" | "sliding_patio" | "pocket";
  widthCm: number;
  opensInward: boolean;
  hingeSide: "left" | "right";
  leadsTo?: "garden" | "balcony" | "hallway" | "unknown";
  isGlazed?: boolean;
  floorToCeiling?: boolean;
}

interface WindowFeature {
  type: "window";
  subtype: "single" | "double" | "triple" | "bay_angular" | "bow" | "box_bay" | "sash" | "floor_to_ceiling";
  widthCm: number;
  heightCm: number;
  heightFromFloorCm: number;
  hasRadiatorBelow: boolean;
  projectionCm?: number;
  hasWindowSeat?: boolean;
}

interface FireplaceFeature {
  type: "fireplace";
  subtype: "traditional" | "inset" | "freestanding" | "electric";
  chimneyBreastWidthCm?: number;
}

type WallFeature = DoorFeature | WindowFeature | FireplaceFeature | { type: "nothing" };

interface RoomFeatures {
  walls: Record<WallRole, { features: WallFeature[] }>;
  roomShape: "rectangular";
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PromptMeta = {
  projectName?: string | null;
  designStyle?: string | null;
  wallColorPalette?: string | null;
  flooringType?: string | null;
  roomFeatures?: RoomFeatures | null;         // user-mapped wall features
  structuredFloorPlan?: FloorPlanAnalysis | null; // Gemini Vision structured analysis
  floorPlanInterpretation?: string | null;   // plain-text rich description (Step A of two-step flow)
  cameraAngle?: "primary" | "secondary";     // "secondary" = alternative viewpoint
  virtualStaging?: boolean;                  // agent mode: Gemini imagines furniture freely, no product catalogue
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractBayWindow(rf: RoomFeatures): { role: WallRole; w: WindowFeature } | null {
  for (const role of ["far", "left", "right", "entrance"] as WallRole[]) {
    for (const f of rf.walls[role].features) {
      if (f.type === "window") {
        const w = f as WindowFeature;
        if (["bay_angular", "bow", "box_bay"].includes(w.subtype)) return { role, w };
      }
    }
  }
  return null;
}

const BAY_LABELS: Record<"bay_angular" | "bow" | "box_bay", string> = {
  bay_angular: "angular bay window",
  bow:         "curved bow window",
  box_bay:     "box bay window",
};

const PHOTO_POS: Record<WallRole, string> = {
  far:      "straight ahead — the far wall",
  left:     "LEFT side of the photograph",
  right:    "RIGHT side of the photograph",
  entrance: "behind the camera (entrance wall)",
};

const DOOR_LABELS: Record<DoorFeature["subtype"], string> = {
  single:        "single door",
  double:        "double/French doors",
  sliding:       "sliding door",
  bifold:        "bi-fold door",
  sliding_patio: "sliding patio doors",
  pocket:        "pocket door",
};

const FIREPLACE_LABELS: Record<FireplaceFeature["subtype"], string> = {
  traditional: "traditional fireplace with chimney breast",
  inset:       "inset fireplace (flush to wall)",
  freestanding:"freestanding stove",
  electric:    "electric fireplace",
};

const WINDOW_LABELS: Record<"single" | "double" | "triple" | "sash" | "floor_to_ceiling", string> = {
  single:          "Window",
  double:          "Two windows",
  triple:          "Three or more windows",
  sash:            "Sash window",
  floor_to_ceiling:"Floor-to-ceiling window",
};

// ── Visual description extractor ─────────────────────────────────────────────
// Pulls material, colour, and finish cues from a product description so Gemini
// gets a visual brief rather than just a product name.

const MATERIAL_KEYWORDS = [
  // Timbers
  "teak","oak","walnut","pine","birch","beech","ash","mahogany","rosewood","bamboo",
  "reclaimed wood","solid wood","hardwood","mdf","plywood","rattan","wicker",
  // Metals
  "brass","copper","chrome","steel","iron","aluminium","gold","bronze","nickel","pewter",
  // Upholstery
  "velvet","linen","cotton","wool","leather","faux leather","boucle","bouclé",
  "fabric","suede","chenille","tweed","silk","mohair",
  // Other materials
  "glass","marble","granite","concrete","stone","ceramic","acrylic","resin",
  "mirrored","lacquered","painted","powder-coated",
  // Colours / finishes
  "white","black","grey","gray","navy","cream","beige","charcoal","natural","nude",
  "sage","green","blush","pink","blue","tan","brown","dark","pale",
  "matte","gloss","brushed","smoked","bleached","distressed","oiled","waxed",
];

function extractVisualDescription(title: string, raw: string | null): string | null {
  // Strip HTML tags and decode entities from description, then combine with title
  const cleanDesc = (raw ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();

  const text = `${title} ${cleanDesc}`.toLowerCase();

  const found: string[] = [];
  for (const kw of MATERIAL_KEYWORDS) {
    if (text.includes(kw) && !found.includes(kw)) found.push(kw);
  }

  if (found.length === 0) return null;

  // Cap at 6 cues to keep the prompt tight
  return found.slice(0, 6).join(", ");
}

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildPrompt(
  userPrompt: string,
  products: ProductForPrompt[],
  room: RoomDimensionsMm,
  meta: PromptMeta = {},
): string {
  const { projectName, designStyle, wallColorPalette, flooringType, roomFeatures, structuredFloorPlan, floorPlanInterpretation, cameraAngle } = meta;

  const rf      = roomFeatures ?? null;
  const spatial = rf ? analyzeRoomSpatially(rf) : null;

  // Pre-extract features by type
  const bayEntry   = rf ? extractBayWindow(rf) : null;
  const bayLabel   = bayEntry ? BAY_LABELS[bayEntry.w.subtype as keyof typeof BAY_LABELS] : null;
  const door       = rf?.walls.entrance.features.find(f => f.type === "door") as DoorFeature | undefined;
  const fireplaces: Array<{ role: WallRole; fp: FireplaceFeature }> = [];
  const regularWindows: Array<{ role: WallRole; w: WindowFeature }> = [];

  // Glazed doors on non-entrance walls (patio/French/bifold) also act as light sources
  const glazedDoorLightSources: Array<{ role: WallRole; door: DoorFeature }> = [];

  if (rf) {
    for (const role of ["entrance", "far", "left", "right"] as WallRole[]) {
      for (const f of rf.walls[role].features) {
        if (f.type === "fireplace") fireplaces.push({ role, fp: f as FireplaceFeature });
        if (f.type === "window") {
          const w = f as WindowFeature;
          if (!["bay_angular", "bow", "box_bay"].includes(w.subtype)) regularWindows.push({ role, w });
        }
        if (f.type === "door" && role !== "entrance") {
          const d = f as DoorFeature;
          if (d.subtype === "sliding_patio" || d.isGlazed) {
            glazedDoorLightSources.push({ role, door: d });
          }
        }
      }
    }
  }

  // True when the only natural light comes from glazed doors (no windows, no bay)
  const hasOnlyGlazedDoorLight = glazedDoorLightSources.length > 0 && !bayEntry && regularWindows.length === 0;

  // Room shape & proportions
  const lengthM  = (room.length / 1000).toFixed(1);
  const widthM   = (room.width  / 1000).toFixed(1);
  const ceilingM = (room.ceilingHeight / 1000).toFixed(1);
  const areaM2   = (room.length / 1000) * (room.width / 1000);
  const longer   = Math.max(room.length, room.width) / 1000;
  const shorter  = Math.min(room.length, room.width) / 1000;
  const ratio    = longer / shorter;
  const shapeDesc = ratio >= 1.6
    ? `strongly elongated — ${longer.toFixed(1)}m × ${shorter.toFixed(1)}m (${ratio.toFixed(1)}:1 ratio)`
    : ratio >= 1.25
      ? `moderately elongated — ${longer.toFixed(1)}m × ${shorter.toFixed(1)}m`
      : `nearly square — ${longer.toFixed(1)}m × ${shorter.toFixed(1)}m`;
  const ceilingFeel = parseFloat(ceilingM) < 2.4 ? "low/intimate" : parseFloat(ceilingM) > 2.7 ? "lofty" : "standard height";

  // Surfaces & style
  const styleLabel = designStyle ? (DESIGN_STYLE_LABELS[designStyle] ?? designStyle) : "interior design";
  const roomLabel  = projectName ?? "room";
  const wallDesc   = wallColorPalette ? (WALL_COLOR_DESCRIPTIONS[wallColorPalette] ?? `${wallColorPalette} walls`) : null;
  const floorDesc  = flooringType ? (FLOORING_DESCRIPTIONS[flooringType] ?? flooringType) : null;

  // Furniture lines
  const productLines = products.map((p) => {
    const price    = p.priceGbp != null ? ` (£${p.priceGbp.toFixed(0)})` : "";
    const cat      = p.category ? p.category.replace(/_/g, " ") : null;
    const dims     = p.widthMm && p.depthMm && p.heightMm
      ? `${(p.widthMm / 1000).toFixed(2)}m wide × ${(p.depthMm / 1000).toFixed(2)}m deep × ${(p.heightMm / 1000).toFixed(2)}m tall`
      : p.dimensionsRaw ?? null;
    const tags     = p.styleTags.length > 0 ? p.styleTags.join(", ") : null;
    const visuals  = extractVisualDescription(p.title, p.description);
    const details  = [
      cat     ? `type: ${cat}`          : null,
      dims    ? `size: ${dims}`         : null,
      visuals ? `materials: ${visuals}` : null,
      tags    ? `style: ${tags}`        : null,
    ].filter(Boolean).join(" | ");
    return `- "${p.title}"${price}${details ? `\n  [${details}]` : ""}`;
  });

  const lines: string[] = [];

  // ── 1. ROOM DIMENSIONS ────────────────────────────────────────────────────────
  // Start with the physical shell — the 3D space Gemini needs to construct first.
  lines.push(
    "=== 1. ROOM DIMENSIONS ===",
    `Floor plan: ${lengthM}m × ${widthM}m — ${shapeDesc}`,
    `Ceiling: ${ceilingM}m — ${ceilingFeel}`,
    `Floor area: ${areaM2.toFixed(1)}m²`,
    "These proportions are exact. The photograph must reflect them accurately.",
  );

  // ── 1b. FLOOR PLAN INTERPRETATION ─────────────────────────────────────────────
  // Rich plain-text description from Step A of two-step render flow.
  if (floorPlanInterpretation) {
    lines.push(
      "",
      "=== 1b. FLOOR PLAN INTERPRETATION ===",
      "⚠️ READ THIS CAREFULLY — this describes the exact spatial layout of this room:",
      floorPlanInterpretation,
      "The rendered photograph MUST accurately reflect all architectural features described above.",
    );
  }

  // ── 2. ENTRANCE & CAMERA ─────────────────────────────────────────────────────
  // Establish the viewpoint before placing any features.
  lines.push("", "=== 2. ENTRANCE & CAMERA ===");

  // Describe what the camera sees straight ahead — seeds the far wall early.
  const farWallFireplace = fireplaces.find(f => f.role === "far");
  const farWallBay       = bayEntry?.role === "far" ? bayEntry : null;

  if (bayEntry?.role === "left") {
    lines.push(`Camera in the doorframe, angled slightly LEFT toward the ${bayLabel} on the left wall.`);
  } else if (bayEntry?.role === "right") {
    lines.push(`Camera in the doorframe, angled slightly RIGHT toward the ${bayLabel} on the right wall.`);
  } else {
    lines.push("Camera in the doorframe, looking straight ahead toward the far wall.");
  }
  lines.push("First-person viewpoint — as if you just opened the door and are looking into the room.");

  // Immediately state what dominates the far wall so Gemini constructs it correctly from the start.
  if (farWallFireplace) {
    lines.push(
      `The far wall — straight ahead in the photograph — has a ${FIREPLACE_LABELS[farWallFireplace.fp.subtype]} as its centrepiece.` +
      (farWallFireplace.fp.chimneyBreastWidthCm ? ` The chimney breast is ${farWallFireplace.fp.chimneyBreastWidthCm}cm wide.` : "") +
      ` This is the focal point of the room and must be clearly visible in the image.`,
    );
  } else if (farWallBay) {
    lines.push(
      `The far wall — straight ahead — has a ${bayLabel} as its centrepiece.`,
    );
  }

  if (door) {
    const swingSide = door.hingeSide === "left" ? "right" : "left";
    const clearCm   = door.widthCm + (door.opensInward ? 90 : 30);
    lines.push(
      `Entrance: ${DOOR_LABELS[door.subtype]}, ${door.widthCm}cm wide, hinged ${door.hingeSide}, opens ${door.opensInward ? "inward" : "outward"}.`,
      `Keep ${clearCm}cm clear on the ${swingSide} side of the entrance for the door swing. The ${door.hingeSide} side of the entrance wall can have furniture against it.`,
    );
  }

  lines.push(
    "",
    "Orientation diagram (top-down view, camera at bottom):",
    "  ┌────────────────────────┐",
    "  │       FAR WALL         │  ← straight ahead",
    "LEFT WALL            RIGHT WALL",
    "  └────────────────────────┘",
    "          📷 CAMERA (entrance)",
    "RULE: LEFT wall features appear on the LEFT of the image. RIGHT wall features appear on the RIGHT. Never flip or mirror.",
  );

  // ── 3. WINDOWS & NATURAL LIGHT ───────────────────────────────────────────────
  // Windows define the light — place them before surfaces and furniture.
  // Glazed patio/French doors on non-entrance walls also count as light sources.
  if (bayEntry || regularWindows.length > 0 || glazedDoorLightSources.length > 0) {
    lines.push("", "=== 3. WINDOWS & NATURAL LIGHT ===");
  }

  if (bayEntry) {
    const { role, w } = bayEntry;
    const bayLines = [
      `⚠️ MANDATORY ARCHITECTURAL FEATURE: ${(bayLabel ?? "bay window").toUpperCase()} — ${PHOTO_POS[role].toUpperCase()}`,
      `  Dimensions: ${w.widthCm}cm wide × ${w.heightCm}cm tall, sill at ${w.heightFromFloorCm}cm from floor.`,
      w.projectionCm
        ? `  Projection: protrudes ${w.projectionCm}cm outward from the wall — the 3D bay recess is clearly visible from inside.`
        : "",
      `  What it looks like: ${w.subtype === "bow"
          ? "a smooth curved bank of glass panes bowing outward from the wall face, creating a curved alcove"
          : w.subtype === "bay_angular"
            ? "three flat glass panels in an angular formation (centre panel flanked by two angled side panels), projecting outward"
            : "a rectangular box projection from the wall with glass on three sides"
        }. Natural daylight streams through it and illuminates the room.`,
      w.hasWindowSeat ? "  Window seat: padded bench fills the bay recess — include it." : "",
      w.hasRadiatorBelow ? "  Radiator panel is visible below the window sill." : "",
      `  This window MUST be clearly visible in the final image. Do not omit it or hide it behind curtains.`,
    ].filter(Boolean);
    lines.push(...bayLines);
  }

  for (const { role, w } of regularWindows) {
    const label = WINDOW_LABELS[w.subtype as keyof typeof WINDOW_LABELS] ?? "Window";
    lines.push(
      `${label} — ${PHOTO_POS[role]}: ${w.widthCm}cm wide × ${w.heightCm}cm tall, sill at ${w.heightFromFloorCm}cm from floor.` +
      (w.hasRadiatorBelow ? " Radiator below." : ""),
    );
  }

  // Glazed doors as primary light sources — treat them exactly like large windows
  for (const { role, door } of glazedDoorLightSources) {
    const destination = door.leadsTo === "garden" ? "garden" : door.leadsTo === "balcony" ? "balcony" : "outside";
    lines.push(...[
      `⚠️ MAJOR LIGHT SOURCE: ${DOOR_LABELS[door.subtype].toUpperCase()} — ${PHOTO_POS[role].toUpperCase()}`,
      `  ${door.widthCm}cm wide${door.floorToCeiling ? ", floor-to-ceiling glass" : ""}. Leads to: ${destination}. Treat this exactly like a large window for lighting purposes.`,
      door.floorToCeiling ? "  The glass spans from floor to ceiling — maximum daylight penetration and visual openness." : "",
      `  Bright ${destination} daylight streams in from the ${role} direction. Do NOT render this as a dark wall.`,
      `  Keep 150cm clear in front of the doors for access.`,
      door.leadsTo === "garden" ? "  Show the suggestion of a garden view through the glass." : "",
      door.leadsTo === "balcony" ? "  Show the suggestion of a balcony/sky view through the glass." : "",
    ].filter(Boolean) as string[]);
  }

  if (hasOnlyGlazedDoorLight) {
    lines.push(
      "",
      "LIGHTING NOTE — NO TRADITIONAL WINDOWS IN THIS ROOM:",
      "Natural light enters entirely through the glazed door(s) listed above.",
      "Do NOT render this as a dark or artificially lit interior.",
      "The glazed doors provide ample natural daylight — render with the same bright, airy quality as a windowed room.",
      "Expect dramatic directional light, strong indoor/outdoor connection, and a beautiful view through the glass.",
    );
  }

  if (spatial?.lightSources.length) {
    lines.push(`Natural light: ${spatial.lightSources.map(ls => ls.description).join(" ")}`);
    if (spatial.crossLightNote) lines.push(spatial.crossLightNote);
  }

  // ── 4. OTHER FIXED FEATURES ───────────────────────────────────────────────────
  if (fireplaces.length > 0) {
    lines.push("", "=== 4. FIXED FEATURES ===");
    for (const { role, fp } of fireplaces) {
      const isFarWall = role === "far";
      const fpLines = [
        `⚠️ MANDATORY ARCHITECTURAL FEATURE: ${FIREPLACE_LABELS[fp.subtype].toUpperCase()} — ${PHOTO_POS[role].toUpperCase()}${fp.chimneyBreastWidthCm ? ` (${fp.chimneyBreastWidthCm}cm wide)` : ""}.`,
        isFarWall
          ? "  This fireplace is the focal point of the room — it must dominate the far wall and be fully visible in the image."
          : "  This fireplace must be clearly visible in the image.",
        "  Keep a 100cm clear zone directly in front of the fireplace — no furniture placed there.",
        fp.subtype === "traditional" ? "  Alcoves either side of the chimney breast suit shelving or built-ins." : "",
        `  This fireplace MUST appear in the final image. Do not omit it.`,
      ].filter(Boolean);
      lines.push(...fpLines);
    }
  }

  // ── 4b. FLOOR PLAN FEATURES (from Gemini Vision analysis) ────────────────────
  if (structuredFloorPlan) {
    const sfp = structuredFloorPlan;
    const staircases  = sfp.specialFeatures.filter((f) => f.type === "staircase");
    const focalFeats  = sfp.specialFeatures.filter((f) => f.isFocalPoint && f.type !== "staircase");
    // Include ALL non-staircase, non-focal features — nooks, alcoves, etc. even without clearance
    const otherFeats  = sfp.specialFeatures.filter((f) => !f.isFocalPoint && f.type !== "staircase");
    const lightOpenings = sfp.openings.filter((o) => o.isLightSource);

    // Room shape — critical for non-rectangular rooms
    if (sfp.shapeDescription && sfp.shapeDescription !== "Unknown") {
      lines.push("", "=== 4b. ROOM SHAPE ===");
      lines.push(`⚠️ THIS ROOM IS NOT A SIMPLE RECTANGLE: ${sfp.shapeDescription}`);
      if (sfp.overallDescription) lines.push(sfp.overallDescription);
      lines.push("The rendered image MUST reflect this non-rectangular shape accurately — do not render a plain rectangular box.");
    }

    if (staircases.length > 0) {
      lines.push("", "=== 4b. STAIRCASE INTRUSION ===");
      for (const s of staircases) {
        lines.push(
          `⚠️ MANDATORY CONSTRAINT: STAIRCASE INTRUSION${s.corner ? ` IN ${s.corner.toUpperCase()} CORNER` : ""}.`,
          `  ${s.description}`,
          `  This space is NOT usable floor area — DO NOT place furniture here.`,
          `  The room is NOT a full rectangle — this corner is physically cut away.`,
        );
      }
    }

    // Focal features (fireplace, bay window, etc.) only when user hasn't mapped them via FloorPlanMapper
    if (focalFeats.length > 0 && fireplaces.length === 0 && !bayEntry) {
      lines.push("", "=== 4b. KEY ARCHITECTURAL FEATURES ===");
      for (const feat of focalFeats) {
        lines.push(...[
          `⚠️ MANDATORY ARCHITECTURAL FEATURE: ${feat.description.toUpperCase()}`,
          feat.approximateSize ? `  Size: ${feat.approximateSize}` : "",
          feat.keepClearCm ? `  Keep ${feat.keepClearCm}cm clear directly in front of this feature.` : "",
          `  This feature MUST be clearly visible in the final image — do not omit or obscure it.`,
        ].filter(Boolean) as string[]);
      }
    }

    // All other features — nooks, alcoves, chimney breasts, built-ins
    if (otherFeats.length > 0) {
      lines.push("", "=== 4b. ROOM FEATURES ===");
      for (const feat of otherFeats) {
        lines.push(...[
          `${feat.description}`,
          feat.approximateSize ? `  Size: ${feat.approximateSize}` : "",
          feat.wall ? `  Location: ${feat.wall} wall` : "",
          feat.corner ? `  Location: ${feat.corner} corner` : "",
          feat.keepClearCm ? `  Keep ${feat.keepClearCm}cm clear.` : "",
        ].filter(Boolean) as string[]);
      }
    }

    // Light sources — only emit when no manual wall mapping (avoids duplication)
    if (!rf && lightOpenings.length > 0) {
      lines.push("", "=== 4b. NATURAL LIGHT SOURCES ===");
      for (const opening of lightOpenings) {
        lines.push(...[
          `${opening.description}${opening.approximateWidthM ? ` (${opening.approximateWidthM}m wide)` : ""} — MAJOR LIGHT SOURCE from ${opening.wall ?? "unknown"} direction.`,
          opening.keepClearCm && opening.keepClearCm > 0 ? `  Keep ${opening.keepClearCm}cm clear for access.` : "",
          opening.type === "patio_doors" ? "  Show a suggestion of the view beyond the glass. Use light, airy materials nearby." : "",
        ].filter(Boolean) as string[]);
      }
    }

    // Furniture placement constraints
    if (sfp.furniturePlacementNotes.length > 0) {
      lines.push("", "=== 4b. FLOOR PLAN PLACEMENT CONSTRAINTS ===");
      for (const note of sfp.furniturePlacementNotes) {
        lines.push(`- ${note}`);
      }
    }

    if (sfp.dimensions.usableAreaM2 > 0) {
      lines.push(
        "",
        `Usable floor area (after accounting for features): ${sfp.dimensions.usableAreaM2.toFixed(1)}m²`,
      );
    }
  }

  // ── 5. SURFACES ───────────────────────────────────────────────────────────────
  // Wall colour and flooring define the palette the furniture sits against.
  if (wallDesc || floorDesc) {
    lines.push("", "=== 5. SURFACES ===");
    if (wallDesc)  lines.push(`Walls: ${wallDesc}`);
    if (floorDesc) lines.push(`Flooring: ${floorDesc}`);
  }

  // ── 6. ROOM TYPE & STYLE ──────────────────────────────────────────────────────
  lines.push(
    "",
    "=== 6. ROOM TYPE & STYLE ===",
    `This is a ${styleLabel} ${roomLabel}.`,
    `Style direction: ${userPrompt}`,
  );

  // ── 7. FURNITURE ─────────────────────────────────────────────────────────────
  // Furniture is placed last — into the scene already established above.
  if (meta.virtualStaging) {
    lines.push(
      "",
      "=== 7. VIRTUAL STAGING — IMAGINED FURNITURE ===",
      "This is a professional virtual staging render for a UK property listing.",
      "Do NOT reference specific product names, retailers, or brands.",
      `Furnish this ${roomLabel} completely in the ${styleLabel} style with beautiful, well-proportioned imagined furniture:`,
      `  - Every piece must be correctly scaled to the room dimensions — a ${lengthM}m × ${widthM}m room cannot hold oversized furniture`,
      `  - Include all pieces appropriate for a ${roomLabel}: seating, tables, storage, rugs, lighting, textiles, artwork, plants`,
      "  - Furniture placement must flow naturally — nothing blocking windows, doors, or fireplaces",
      "  - The result should look like a beautiful, move-in-ready home that makes a buyer fall in love with the property",
      "  - Photorealistic quality — as if staged by a professional interior designer for a high-end property listing",
      "",
      "Fill the space generously but not cluttered. No large empty floor areas. Style every surface.",
    );
  } else if (products.length > 0) {
    lines.push(
      "",
      "=== 7. FURNITURE ===",
      "Place these exact pieces in the room. Scale each item accurately — a 2.2m sofa must look 2.2m wide relative to the walls.",
      ...productLines,
    );
  }

  // ── 8. PLACEMENT RULES ────────────────────────────────────────────────────────
  if (spatial?.placementRules.length) {
    lines.push("", "=== 8. PLACEMENT RULES ===");
    for (const rule of spatial.placementRules) lines.push(`- ${rule}`);
  }

  // ── OUTPUT REQUIREMENTS ───────────────────────────────────────────────────────
  lines.push(
    "",
    "=== OUTPUT REQUIREMENTS ===",
    "- Photorealistic interior design photograph — not a 3D render or illustration",
    "- Bright neutral midday daylight — not golden hour, not evening light",
    "- No text, watermarks, or labels in the image",
    "- Windows are bare or have sheer curtains fully open and tied back — the window frame, shape, and type must be clearly visible",
    "- All mandatory features (fireplace, bay window, etc.) must be present and unobstructed in the final image",
  );

  // ── SECONDARY CAMERA ANGLE ────────────────────────────────────────────────────
  if (cameraAngle === "secondary") {
    lines.push(
      "",
      "=== ALTERNATIVE CAMERA ANGLE ===",
      "⚠️ DIFFERENT VIEWPOINT: Do NOT shoot from the entrance doorway.",
      "Instead, shoot from the OPPOSITE corner — stand in the far corner of the room and look back toward the entrance door.",
      "This gives a completely different perspective on the same room, furniture, and design.",
      "The entrance door should now be visible in the background or to one side.",
      "Same furniture, same surfaces, same lighting — but a fresh angle showing different aspects of the room.",
    );
  }

  return lines.join("\n");
}

/** Stage a real room photo using a plain-English brief. Returns a PNG buffer. */
// ─────────────────────────────────────────────────────────────────────────────
// Two-step virtual staging pipeline:
//   Step 1 — Gemini analyses the photo (text only, cheap ~$0.001)
//   Step 2 — Reve generates the staged image using Gemini's description (~$0.007)
// ─────────────────────────────────────────────────────────────────────────────

export async function virtualStageRoom(
  cfg: { apiKey?: string; model: string; region?: string; reveApiKey?: string },
  opts: { photoData: string; photoMimeType: string; brief: string }
): Promise<{ buffer: Buffer; mock: boolean }> {
  if (!cfg.apiKey) {
    console.log("[Staging] No Gemini API key — returning placeholder (mock mode)");
    return { buffer: await placeholderBuffer(), mock: true };
  }

  // ── Step 1: Gemini analyses the room (text model, no image generation) ──────
  console.log("[Staging] Step 1: Gemini analysing room…");

  const analysisPrompt = buildStagingAnalysisPrompt(opts.brief);

  const baseUrl =
    cfg.region === "EU"
      ? "https://eu-generativelanguage.googleapis.com"
      : "https://generativelanguage.googleapis.com";

  const ai = new GoogleGenAI({ apiKey: cfg.apiKey, httpOptions: { baseUrl } });

  const analysisResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      { text: analysisPrompt },
      { inlineData: { mimeType: opts.photoMimeType, data: opts.photoData } },
    ],
  });

  const stagingDescription = analysisResponse.candidates?.[0]?.content?.parts
    ?.find((p) => p.text)?.text ?? "";

  if (!stagingDescription) {
    throw new Error("[Staging] Gemini returned no analysis text.");
  }

  console.log("[Staging] Gemini description (first 300 chars):");
  console.log(stagingDescription.slice(0, 300));

  // ── Step 2: Reve generates the staged image (falls back to Gemini if not configured) ──
  if (cfg.reveApiKey) {
    console.log("[Staging] Step 2: Reve generating staged image…");

    const imageBuffer = Buffer.from(opts.photoData, "base64");
    const reveBuffer = await stageWithReve(imageBuffer, stagingDescription, cfg.reveApiKey);

    const buffer = await sharp(reveBuffer)
      .resize(RENDER_WIDTH, RENDER_HEIGHT, { fit: "cover" })
      .png()
      .toBuffer();

    console.log(`[Staging] Complete via Reve — ${buffer.length} bytes`);
    return { buffer, mock: false };
  }

  // Reve not configured — fall back to Gemini image generation using the analysis description
  console.log("[Staging] REVE_API_KEY not set — falling back to Gemini image generation");

  const geminiImageResponse = await ai.models.generateContent({
    model: cfg.model,
    contents: [
      { text: stagingDescription },
      { inlineData: { mimeType: opts.photoMimeType, data: opts.photoData } },
    ],
    config: { responseModalities: ["IMAGE"] },
  });

  const parts = geminiImageResponse.candidates?.[0]?.content?.parts ?? [];
  let imageBase64: string | undefined;
  for (const part of parts) {
    if (part.inlineData?.data) { imageBase64 = part.inlineData.data; break; }
  }

  if (!imageBase64) {
    throw new Error("[Staging] Gemini returned no image. Check model name and API access.");
  }

  const buffer = await sharp(Buffer.from(imageBase64, "base64"))
    .resize(RENDER_WIDTH, RENDER_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();

  console.log(`[Staging] Complete via Gemini fallback — ${buffer.length} bytes`);
  return { buffer, mock: false };
}

function buildStagingAnalysisPrompt(brief: string): string {
  return `You are an expert interior designer specialising in virtual property staging for UK estate agents.

Analyse this empty room photo carefully.

OBSERVE:
- Room shape and approximate size
- Window positions and natural light direction
- Door positions
- Flooring type and colour
- Wall colours and finish
- Any architectural features (fireplace, alcoves, bay windows, cornicing, ceiling roses, beams)

AGENT'S BRIEF: ${brief}

YOUR TASK:
Write a detailed image generation prompt for Reve AI to virtually stage this room.

The prompt MUST:

1. Start by describing what to KEEP:
   "Keep the [floor], [walls], [windows] exactly as they are."

2. List EXACTLY what furniture to ADD:
   For each piece specify item name and size, exact position in the room, colour and material.
   Example: "Add a light grey linen 3-seater sofa against the far wall facing the window. Add a round walnut coffee table centred in front of the sofa."

3. Add soft furnishings: rug (pattern and colour), cushions and throws, curtains or blinds, plants (specific types), artwork on walls, lighting (floor lamps, table lamps), books, vases, accessories.

4. End with: "Photorealistic interior photography, natural lighting, magazine quality, no people."

IMPORTANT:
- Be very specific about positions
- Match everything to the actual room you can see in the photo
- Place furniture respecting the windows and doors you can see
- The result must look like a REAL photo, not a render

Return ONLY the staging prompt. Nothing else. No preamble.
Start with: "Keep the..."`;
}

async function stageWithReve(
  imageBuffer: Buffer,
  stagingPrompt: string,
  reveApiKey?: string
): Promise<Buffer> {
  if (!reveApiKey) {
    throw new Error("[Staging] REVE_API_KEY not configured — add it to Railway environment variables");
  }

  console.log("[Staging] Calling Reve API…");
  console.log("[Staging] Prompt length:", stagingPrompt.length);

  const response = await fetch("https://api.reve.com/v1/image/edit", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${reveApiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      image: imageBuffer.toString("base64"),
      prompt: stagingPrompt,
      preserve_background: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Staging] Reve API error:", errorText);
    throw new Error(`Reve error: ${response.status} — ${errorText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await response.json() as Record<string, any>;

  // Log full response keys so we can confirm field names if anything goes wrong
  console.log("[Staging] Reve response keys:", Object.keys(data));

  // Reve returns the image as base64-encoded PNG in the `image` field
  const base64 = data.image as string | undefined;

  if (!base64) {
    console.error("[Staging] Unexpected Reve response shape:", JSON.stringify(data, null, 2));
    throw new Error("No image in Reve response — check Railway logs");
  }

  return Buffer.from(base64, "base64");
}

/** Generate a room image using the Gemini API. Returns a PNG buffer. */
export async function generateRoomImage(
  cfg: { apiKey?: string; model: string; region?: string },
  opts: { userPrompt: string; products: ProductForPrompt[]; room: RoomDimensionsMm; floorPlan?: { data: string; mimeType: string } | null } & PromptMeta
): Promise<{ buffer: Buffer; mock: boolean }> {
  if (!cfg.apiKey) {
    console.log("[Gemini] No API key — returning placeholder (mock mode)");
    return { buffer: await placeholderBuffer(), mock: true };
  }

  // Route to EU endpoint when configured — placeholder for when Google exposes one.
  const baseUrl =
    cfg.region === "EU"
      ? "https://eu-generativelanguage.googleapis.com"
      : "https://generativelanguage.googleapis.com";

  console.log(`[Gemini] Generating image — model: ${cfg.model}, region: ${cfg.region ?? "global"}`);

  const ai = new GoogleGenAI({ apiKey: cfg.apiKey, httpOptions: { baseUrl } });
  const prompt = buildPrompt(opts.userPrompt, opts.products, opts.room, {
    projectName:         opts.projectName,
    designStyle:         opts.designStyle,
    wallColorPalette:    opts.wallColorPalette,
    flooringType:        opts.flooringType,
    roomFeatures:        opts.roomFeatures,
    structuredFloorPlan: opts.structuredFloorPlan,
  });

  console.log("[Gemini] Prompt:\n" + prompt);

  // Include the floor plan image directly when available — Gemini reads the
  // spatial layout (doors, windows, features) from the image itself.
  const contents = opts.floorPlan
    ? [
        { text: prompt },
        { inlineData: { mimeType: opts.floorPlan.mimeType, data: opts.floorPlan.data } },
      ]
    : prompt;

  if (opts.floorPlan) {
    console.log(`[Gemini] Floor plan image included in request (${opts.floorPlan.mimeType})`);
  }

  const response = await ai.models.generateContent({
    model: cfg.model,
    contents,
    config: { responseModalities: ["IMAGE"] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let imageBase64: string | undefined;
  for (const part of parts) {
    if (part.inlineData?.data) {
      imageBase64 = part.inlineData.data;
      break;
    }
  }

  if (!imageBase64) {
    console.error("[Gemini] Response contained no image data:", JSON.stringify(response.candidates?.[0]));
    throw new Error("Model returned no image. Check model name and API access.");
  }

  console.log(`[Gemini] Image received (${imageBase64.length} base64 chars) — resizing to ${RENDER_WIDTH}×${RENDER_HEIGHT}`);

  const buffer = await sharp(Buffer.from(imageBase64, "base64"))
    .resize(RENDER_WIDTH, RENDER_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();

  console.log(`[Gemini] Done — PNG buffer size: ${buffer.length} bytes`);

  return { buffer, mock: false };
}
