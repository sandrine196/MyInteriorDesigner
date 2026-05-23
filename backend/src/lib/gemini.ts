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

// ── Room features → prompt text ────────────────────────────────────────────────

function describeFeature(f: WallFeature): string {
  if (f.type === "nothing") return "No notable features";

  if (f.type === "door") {
    const d = f as DoorFeature;
    const typeLabel = { single: "Single door", double: "Double / French doors", sliding: "Sliding door", bifold: "Bi-fold door" }[d.subtype];
    return `${typeLabel} (${d.widthCm}cm wide, opens ${d.opensInward ? "inward" : "outward"}, ${d.hingeSide} hinge)`;
  }

  if (f.type === "window") {
    const w = f as WindowFeature;
    const isBay = w.subtype === "bay_angular" || w.subtype === "bow" || w.subtype === "box_bay";
    const bayLabel = { bay_angular: "Bay window — angular 3-panel", bow: "Bow window — curved 4-5 panels", box_bay: "Box bay window" }[w.subtype as "bay_angular"|"bow"|"box_bay"];
    const stdLabel = { single: "Window", double: "Two windows", triple: "Three or more windows" }[w.subtype as "single"|"double"|"triple"] ?? "Window";
    const dims = `${w.widthCm}cm wide × ${w.heightCm}cm tall, ${w.heightFromFloorCm}cm from floor`;
    if (isBay) {
      const extras = [
        w.projectionCm ? `projects ${w.projectionCm}cm into room` : null,
        w.hasWindowSeat ? "HAS WINDOW SEAT" : null,
        w.hasRadiatorBelow ? "radiator below" : null,
      ].filter(Boolean).join(", ");
      return `${bayLabel} — ${dims}${extras ? `, ${extras}` : ""}`;
    }
    return `${stdLabel} — ${dims}${w.hasRadiatorBelow ? ", radiator below" : ""}`;
  }

  if (f.type === "fireplace") {
    const fp = f as FireplaceFeature;
    const label = { traditional: "Traditional fireplace with chimney breast", inset: "Inset fireplace (flush with wall)", freestanding: "Freestanding fireplace", electric: "Electric fireplace" }[fp.subtype];
    return fp.chimneyBreastWidthCm ? `${label} (${fp.chimneyBreastWidthCm}cm wide)` : label;
  }

  return "";
}

function buildFeaturesSection(rf: RoomFeatures): string {
  const spatial = analyzeRoomSpatially(rf);

  const ROLE_LABELS: Record<WallRole, string> = {
    entrance: "Entrance wall (camera looking FROM this wall)",
    far:      "Far wall (camera looking TOWARDS this wall)",
    left:     "Left wall (on your left as you enter)",
    right:    "Right wall (on your right as you enter)",
  };

  const lines: string[] = ["ARCHITECTURAL FEATURES (NON-NEGOTIABLE POSITIONS):"];

  for (const role of ["entrance", "far", "left", "right"] as WallRole[]) {
    const wall = rf.walls[role];
    lines.push(`\n${ROLE_LABELS[role]}:`);
    if (!wall.features.length) {
      lines.push("- No notable features");
    } else {
      for (const f of wall.features) {
        lines.push(`- ${describeFeature(f)}`);
      }
    }
  }

  // Camera and focal point (from spatial reasoning)
  lines.push("\nCAMERA SETUP:");
  lines.push("- Camera positioned at the ENTRANCE WALL — photographer standing IN THE DOORFRAME looking INTO the room");
  if (spatial.focalPoint) {
    lines.push(`- FOCAL POINT: ${spatial.focalPoint.label}`);
    lines.push(`- ${spatial.focalPoint.description}`);
  }

  // Light sources
  if (spatial.lightSources.length > 0) {
    lines.push("\nNATURAL LIGHT:");
    for (const ls of spatial.lightSources) {
      lines.push(`- ${ls.description}`);
    }
    if (spatial.crossLightNote) {
      lines.push(`- ${spatial.crossLightNote}`);
    }
  }

  // Placement rules (from spatial reasoning)
  lines.push("\nFURNITURE PLACEMENT RULES (MANDATORY):");
  for (const rule of spatial.placementRules) {
    lines.push(`- ${rule}`);
  }

  // Dedicated bay window callout — Gemini needs this emphasised
  const bayEntries: Array<{ role: WallRole; w: WindowFeature }> = [];
  for (const role of ["entrance", "far", "left", "right"] as WallRole[]) {
    for (const f of rf.walls[role].features) {
      if (f.type === "window") {
        const w = f as WindowFeature;
        if (["bay_angular", "bow", "box_bay"].includes(w.subtype)) {
          bayEntries.push({ role, w });
        }
      }
    }
  }
  if (bayEntries.length > 0) {
    const { role, w } = bayEntries[0];
    const bayTypeLabel = { bay_angular: "Angular 3-panel bay", bow: "Curved bow", box_bay: "Box bay" }[w.subtype as "bay_angular"|"bow"|"box_bay"];
    const bayLines = [
      "",
      "BAY WINDOW (KEY ARCHITECTURAL FEATURE — MUST BE PROMINENT):",
      `- Type: ${bayTypeLabel} window`,
      `- Location: ${role} wall`,
      `- Width: ${w.widthCm}cm, projects ${w.projectionCm ?? "~40"}cm into the room`,
      `- Height: ${w.heightCm}cm tall, sill at ${w.heightFromFloorCm}cm from floor`,
      w.hasWindowSeat ? "- INCLUDE a padded window seat cushion in the bay alcove" : null,
      w.hasRadiatorBelow ? "- Radiator panel visible below window sill" : null,
      "- This bay window is the FOCAL POINT — photograph it beautifully with strong natural daylight streaming through",
      "- The three-dimensional bay recess must be clearly visible in the photograph",
    ].filter((l): l is string => l !== null);
    lines.push(...bayLines);
  }

  // Spatial narrative — summarises the holistic room logic for the model
  lines.push("", spatial.promptNarrative);

  return lines.join("\n");
}

export type PromptMeta = {
  projectName?: string | null;
  designStyle?: string | null;
  wallColorPalette?: string | null;
  flooringType?: string | null;
  floorPlanAnalysis?: string | null;
  roomFeatures?: RoomFeatures | null;
};

export function buildPrompt(
  userPrompt: string,
  products: ProductForPrompt[],
  room: RoomDimensionsMm,
  meta: PromptMeta = {},
): string {
  const { projectName, designStyle, wallColorPalette, flooringType, floorPlanAnalysis, roomFeatures } = meta;

  const styleLabel = designStyle ? (DESIGN_STYLE_LABELS[designStyle] ?? designStyle) : "interior";
  const roomType   = projectName ?? "room";
  const lengthM    = (room.length / 1000).toFixed(1);
  const widthM     = (room.width / 1000).toFixed(1);
  const ceilingM   = (room.ceilingHeight / 1000).toFixed(1);

  // Custom wall color: any value not in the map is treated as a user description
  const wallDesc = wallColorPalette
    ? (WALL_COLOR_DESCRIPTIONS[wallColorPalette] ?? `${wallColorPalette} walls`)
    : null;
  const floorDesc = flooringType
    ? (FLOORING_DESCRIPTIONS[flooringType] ?? flooringType)
    : null;

  const productLines = products.map((p) => {
    const price    = p.priceGbp != null ? ` - £${p.priceGbp.toFixed(0)}` : "";
    const category = p.category ? p.category.replace(/_/g, " ") : null;
    const dims     =
      p.widthMm && p.depthMm && p.heightMm
        ? `${(p.widthMm / 1000).toFixed(2)}m × ${(p.depthMm / 1000).toFixed(2)}m × ${(p.heightMm / 1000).toFixed(2)}m (W×D×H)`
        : p.dimensionsRaw ?? null;
    const desc = [category, dims].filter(Boolean).join(", ");
    return `- ${p.title} from ${p.retailer}${price}${desc ? `\n  ${desc}` : ""}`;
  });

  const areaM2 = (room.length / 1000) * (room.width / 1000);
  const roomFeel = areaM2 < 12 ? "small and cosy" : areaM2 < 20 ? "medium sized" : "spacious and generous";

  const lines: (string | null)[] = [
    `Professional interior design photograph of a ${styleLabel} ${roomType}.`,
    "Shot from the doorframe entrance - the viewer is standing at the threshold looking into the room.",
    "",
    "ROOM SPECIFICATIONS:",
    `- Dimensions: ${lengthM}m × ${widthM}m with ${ceilingM}m ceiling height`,
    `- Floor area: ${areaM2.toFixed(1)}m² — room feels ${roomFeel}`,
    wallDesc  ? `- Walls: ${wallDesc}`     : null,
    floorDesc ? `- Flooring: ${floorDesc}` : null,
  ];

  if (products.length > 0) {
    lines.push(
      "",
      "FURNITURE (curated mix from UK retailers — all items must be accurately scaled to room dimensions):",
      ...productLines,
    );
  }

  // Structured room features take priority over legacy GPT-4o Vision analysis
  if (roomFeatures) {
    lines.push("", buildFeaturesSection(roomFeatures));
  } else if (floorPlanAnalysis) {
    lines.push(
      "",
      "SPATIAL LAYOUT (EXACT — NON-NEGOTIABLE):",
      floorPlanAnalysis,
      "",
      "You are standing IN THE DOORFRAME looking into the room. ENFORCE these positions exactly:",
      "- If the analysis says a feature is on the RIGHT → it MUST appear on the RIGHT side of the photograph",
      "- If the analysis says a feature is STRAIGHT AHEAD → it MUST be on the wall facing the camera",
      "- If the analysis says a feature is on the LEFT → it MUST appear on the LEFT side of the photograph",
      "- If the analysis says a feature is BEHIND YOU → it is on the same wall as the entrance, partially visible at the frame edges",
      "Do NOT reinterpret or rearrange these positions. The photograph must match this exact spatial layout.",
    );
  }

  lines.push(
    "",
    "STYLE DIRECTION:",
    userPrompt,
    "",
    "CRITICAL REQUIREMENTS:",
    "- This is a PHOTOGRAPH, not a 3D render or illustration — photorealistic, as seen in high-end interior design magazines",
    "- Bright, neutral daylight (midday sun), evenly lit, professional interior photography lighting with soft natural shadows",
    "- Lighting: Bright, neutral midday daylight — NOT sunset, NOT golden hour, NOT evening light",
    `- All furniture must be to scale, respecting the room's actual dimensions (${lengthM}m × ${widthM}m × ${ceilingM}m high) — verify each item physically fits before placing it`,
    "- Furniture is a curated mix from different UK retailers; render each piece accurately as specified",
    "- Arrange furniture following feng shui principles to ensure optimal circulation and flow in the room",
    "- Camera perspective: Photographer is standing IN THE DOORFRAME at the room entrance, looking INTO the room. This is the primary viewpoint - as if you just opened the door and are looking inside. The door frame should be visible at the edges or implied by the angle. Show the ENTIRE room layout from this entrance perspective.",
    "- No text overlays, watermarks, labels, or visible floor plan lines",
  );

  return lines.filter((l) => l !== null).join("\n");
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
