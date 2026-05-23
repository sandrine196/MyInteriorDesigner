import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { analyzeRoomSpatially } from "../services/spatialReasoning.service.js";

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
  scandi:       "Scandi Minimalist",
  industrial:   "Modern Industrial",
  traditional:  "Cosy Traditional",
  midcentury:   "Mid-Century Modern",
  bohemian:     "Bohemian",
  contemporary: "Contemporary Luxe",
  japandi:      "Japandi",
  coastal:      "Coastal",
};

// ── Room features types (mirrors frontend api.ts) ─────────────────────────────

type WallRole = "entrance" | "far" | "left" | "right";

interface DoorFeature {
  type: "door";
  subtype: "single" | "double" | "sliding" | "bifold";
  widthCm: number;
  opensInward: boolean;
  hingeSide: "left" | "right";
}

interface WindowFeature {
  type: "window";
  subtype: "single" | "double" | "triple" | "bay_angular" | "bow" | "box_bay";
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
  floorPlanAnalysis?: string | null;
  roomFeatures?: RoomFeatures | null;
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
  single:  "single door",
  double:  "double/French doors",
  sliding: "sliding door",
  bifold:  "bi-fold door",
};

const FIREPLACE_LABELS: Record<FireplaceFeature["subtype"], string> = {
  traditional: "traditional fireplace with chimney breast",
  inset:       "inset fireplace (flush to wall)",
  freestanding:"freestanding stove",
  electric:    "electric fireplace",
};

const WINDOW_LABELS: Record<"single" | "double" | "triple", string> = {
  single: "Window",
  double: "Two windows",
  triple: "Three or more windows",
};

// ── Prompt builder ────────────────────────────────────────────────────────────

export function buildPrompt(
  userPrompt: string,
  products: ProductForPrompt[],
  room: RoomDimensionsMm,
  meta: PromptMeta = {},
): string {
  const { projectName, designStyle, wallColorPalette, flooringType, floorPlanAnalysis, roomFeatures } = meta;

  const rf      = roomFeatures ?? null;
  const spatial = rf ? analyzeRoomSpatially(rf) : null;

  // Pre-extract features by type
  const bayEntry   = rf ? extractBayWindow(rf) : null;
  const bayLabel   = bayEntry ? BAY_LABELS[bayEntry.w.subtype as keyof typeof BAY_LABELS] : null;
  const door       = rf?.walls.entrance.features.find(f => f.type === "door") as DoorFeature | undefined;
  const fireplaces: Array<{ role: WallRole; fp: FireplaceFeature }> = [];
  const regularWindows: Array<{ role: WallRole; w: WindowFeature }> = [];

  if (rf) {
    for (const role of ["entrance", "far", "left", "right"] as WallRole[]) {
      for (const f of rf.walls[role].features) {
        if (f.type === "fireplace") fireplaces.push({ role, fp: f as FireplaceFeature });
        if (f.type === "window") {
          const w = f as WindowFeature;
          if (!["bay_angular", "bow", "box_bay"].includes(w.subtype)) regularWindows.push({ role, w });
        }
      }
    }
  }

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
    const price   = p.priceGbp != null ? ` (£${p.priceGbp.toFixed(0)})` : "";
    const cat     = p.category ? p.category.replace(/_/g, " ") : null;
    const dims    = p.widthMm && p.depthMm && p.heightMm
      ? `${(p.widthMm / 1000).toFixed(2)}m wide × ${(p.depthMm / 1000).toFixed(2)}m deep × ${(p.heightMm / 1000).toFixed(2)}m tall`
      : p.dimensionsRaw ?? null;
    const tags    = p.styleTags.length > 0 ? p.styleTags.join(", ") : null;
    const details = [
      cat  ? `type: ${cat}`     : null,
      dims ? `size: ${dims}`    : null,
      tags ? `style: ${tags}`   : null,
    ].filter(Boolean).join(" | ");
    return `- "${p.title}" by ${p.retailer}${price}${details ? `\n  [${details}]` : ""}`;
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

  // ── 2. ENTRANCE & CAMERA ─────────────────────────────────────────────────────
  // Establish the viewpoint before placing any features.
  lines.push("", "=== 2. ENTRANCE & CAMERA ===");

  if (bayEntry?.role === "left") {
    lines.push(`Camera in the doorframe, angled slightly LEFT toward the ${bayLabel} on the left wall.`);
  } else if (bayEntry?.role === "right") {
    lines.push(`Camera in the doorframe, angled slightly RIGHT toward the ${bayLabel} on the right wall.`);
  } else {
    lines.push("Camera in the doorframe, looking straight ahead toward the far wall.");
  }
  lines.push("First-person viewpoint — as if you just opened the door and are looking into the room.");

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
  if (bayEntry || regularWindows.length > 0) {
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
      `  This window MUST be clearly visible in the final image. Do not omit it.`,
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

  if (spatial?.lightSources.length) {
    lines.push(`Natural light: ${spatial.lightSources.map(ls => ls.description).join(" ")}`);
    if (spatial.crossLightNote) lines.push(spatial.crossLightNote);
  }

  // ── 4. OTHER FIXED FEATURES ───────────────────────────────────────────────────
  if (fireplaces.length > 0) {
    lines.push("", "=== 4. FIXED FEATURES ===");
    for (const { role, fp } of fireplaces) {
      const fpLines = [
        `${FIREPLACE_LABELS[fp.subtype]} — ${PHOTO_POS[role]}${fp.chimneyBreastWidthCm ? ` (${fp.chimneyBreastWidthCm}cm wide)` : ""}.`,
        "100cm clear zone in front of the fireplace — no furniture placed here.",
        fp.subtype === "traditional" ? "Alcoves either side of the chimney breast suit shelving or built-ins." : "",
      ].filter(Boolean);
      lines.push(...fpLines);
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
  if (products.length > 0) {
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

  // Legacy fallback: no wall mapping but a floor plan analysis exists
  if (!rf && floorPlanAnalysis) {
    lines.push(
      "",
      "SPATIAL LAYOUT:",
      floorPlanAnalysis,
      "Enforce all positions exactly — LEFT features on LEFT, RIGHT features on RIGHT, FAR WALL straight ahead.",
    );
  }

  // ── OUTPUT REQUIREMENTS ───────────────────────────────────────────────────────
  lines.push(
    "",
    "=== OUTPUT REQUIREMENTS ===",
    "- Photorealistic interior design photograph — not a 3D render or illustration",
    "- Bright neutral midday daylight — not golden hour, not evening light",
    "- No text, watermarks, or labels in the image",
  );

  return lines.join("\n");
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
    projectName:       opts.projectName,
    designStyle:       opts.designStyle,
    wallColorPalette:  opts.wallColorPalette,
    flooringType:      opts.flooringType,
    floorPlanAnalysis: opts.floorPlanAnalysis,
    roomFeatures:      opts.roomFeatures,
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
