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

  // Photo-space positions — unambiguous for the image model
  const PHOTO_POS: Record<WallRole, string> = {
    entrance: "BEHIND THE CAMERA / entrance (only partially visible at frame edges)",
    far:      "STRAIGHT AHEAD — the back wall the camera is pointing at",
    left:     "LEFT SIDE OF THE PHOTOGRAPH (viewer's left)",
    right:    "RIGHT SIDE OF THE PHOTOGRAPH (viewer's right)",
  };

  const lines: string[] = [
    "ROOM LAYOUT — MANDATORY SPATIAL POSITIONS:",
    "The photograph is taken standing IN THE DOORFRAME looking INTO the room.",
    "Orientation diagram (top-down view, camera at bottom):",
    "  ┌──────────────────────┐",
    "  │      FAR WALL        │  ← straight ahead in photo",
    "  │   (back of room)     │",
    "  │                      │",
    "LEFT                  RIGHT",
    "WALL                   WALL",
    "  │                      │",
    "  └──────────────────────┘",
    "     📷 CAMERA HERE",
    "  (entrance — doorframe)",
    "",
    "CRITICAL RULE: LEFT wall features appear on the LEFT side of the photo.",
    "CRITICAL RULE: RIGHT wall features appear on the RIGHT side of the photo.",
    "CRITICAL RULE: Do NOT mirror, flip, or reinterpret these positions.",
    "",
    "ARCHITECTURAL FEATURES:",
  ];

  for (const role of ["far", "left", "right", "entrance"] as WallRole[]) {
    const wall = rf.walls[role];
    const hasReal = wall.features.some(f => f.type !== "nothing");
    if (!hasReal && role === "entrance") continue; // entrance with no features is implicit
    lines.push(`\n${PHOTO_POS[role]}:`);
    if (!wall.features.length || !hasReal) {
      lines.push("- No notable architectural features");
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
    const price    = p.priceGbp != null ? ` (£${p.priceGbp.toFixed(0)})` : "";
    const category = p.category ? p.category.replace(/_/g, " ") : null;
    const dims     =
      p.widthMm && p.depthMm && p.heightMm
        ? `${(p.widthMm / 1000).toFixed(2)}m wide × ${(p.depthMm / 1000).toFixed(2)}m deep × ${(p.heightMm / 1000).toFixed(2)}m tall`
        : p.dimensionsRaw ?? null;
    const styleStr = p.styleTags.length > 0 ? p.styleTags.join(", ") : null;
    const details = [
      category ? `type: ${category}` : null,
      dims ? `exact size: ${dims}` : null,
      styleStr ? `style: ${styleStr}` : null,
    ].filter(Boolean).join(" | ");
    return `- "${p.title}" by ${p.retailer}${price}${details ? `\n  [${details}]` : ""}`;
  });

  const areaM2 = (room.length / 1000) * (room.width / 1000);
  const roomFeel = areaM2 < 12 ? "small and cosy" : areaM2 < 20 ? "medium sized" : "spacious and generous";

  // Aspect ratio for visual proportion guidance
  const longer = Math.max(room.length, room.width) / 1000;
  const shorter = Math.min(room.length, room.width) / 1000;
  const ratio = longer / shorter;
  const shapeDesc = ratio >= 1.6
    ? `strongly elongated (${longer.toFixed(1)}m long, ${shorter.toFixed(1)}m wide — about ${ratio.toFixed(1)}× longer than wide)`
    : ratio >= 1.25
      ? `moderately elongated (${longer.toFixed(1)}m × ${shorter.toFixed(1)}m)`
      : `nearly square (${longer.toFixed(1)}m × ${shorter.toFixed(1)}m)`;
  const ceilingFeel = parseFloat(ceilingM) < 2.4 ? "low, intimate ceiling" : parseFloat(ceilingM) > 2.7 ? "lofty, generous ceiling" : "standard ceiling height";

  // Extract bay/bow window early so we can lead the prompt with it if present
  const bayEntry = roomFeatures ? extractBayWindow(roomFeatures) : null;
  const bayTypeLabel = bayEntry
    ? ({ bay_angular: "angular bay window", bow: "curved bow window", box_bay: "box bay window" } as const)[bayEntry.w.subtype as "bay_angular" | "bow" | "box_bay"]
    : null;

  // Camera description adapts to where the focal feature is
  const cameraLine = (() => {
    if (!bayEntry && !roomFeatures) {
      return "Camera in the doorframe, looking straight into the room toward the far wall.";
    }
    if (bayEntry?.role === "far") {
      return `Camera in the doorframe, looking straight ahead toward the far wall where the ${bayTypeLabel} is — it fills the view directly ahead.`;
    }
    if (bayEntry?.role === "left") {
      return `Camera in the doorframe, angled slightly left to feature the ${bayTypeLabel} on the left wall — the window should be prominently visible on the left side of the photograph, flooding the room with natural light.`;
    }
    if (bayEntry?.role === "right") {
      return `Camera in the doorframe, angled slightly right to feature the ${bayTypeLabel} on the right wall — the window should be prominently visible on the right side of the photograph, flooding the room with natural light.`;
    }
    return "Camera in the doorframe, looking straight into the room toward the far wall.";
  })();

  // If there's a bay/bow window, it leads the entire prompt — image models weight early tokens most
  const leadingCallout: string[] = bayEntry ? [
    `⚠️ THIS IMAGE MUST CONTAIN A ${(bayTypeLabel ?? "bay window").toUpperCase()} — THIS IS THE MOST IMPORTANT ELEMENT.`,
    `A ${bayTypeLabel} (${bayEntry.w.widthCm}cm wide, ${bayEntry.w.heightCm}cm tall) is on the ${bayEntry.role === "far" ? "FAR WALL — straight ahead of the camera" : bayEntry.role === "left" ? "LEFT WALL — visible on the left side of the photograph" : "RIGHT WALL — visible on the right side of the photograph"}.`,
    `This is a ${bayTypeLabel}: curved/angled window with multiple panes that projects outward from the wall face, creating a bay recess inside the room. It MUST be clearly visible and architecturally prominent in the finished image.`,
    bayEntry.w.hasWindowSeat ? `The bay has a padded window seat — include it.` : "",
    `Do NOT render this room without the ${bayTypeLabel}. A render without it is incorrect.`,
    "",
  ].filter(Boolean) : [];

  const lines: (string | null)[] = [
    ...leadingCallout,
    `Professional interior design photograph of a ${styleLabel} ${roomType}.`,
    cameraLine,
    "",
    "ROOM PROPORTIONS (MUST BE VISUALLY ACCURATE):",
    `- Floor plan: ${lengthM}m × ${widthM}m — ${shapeDesc}`,
    `- Floor area: ${areaM2.toFixed(1)}m² — ${roomFeel}`,
    `- Ceiling: ${ceilingM}m — ${ceilingFeel}`,
    `- The room shape in the photograph MUST reflect these proportions. Do not make a ${shapeDesc.split(" ")[0]} room look square, and do not make a square room look like a corridor.`,
    wallDesc  ? `- Walls: ${wallDesc}`     : null,
    floorDesc ? `- Flooring: ${floorDesc}` : null,
  ];

  if (products.length > 0) {
    lines.push(
      "",
      "FURNITURE — THESE EXACT PIECES MUST APPEAR IN THE IMAGE:",
      "Each item below is a real product with specific dimensions. Render each piece to match its listed size and style. Do not substitute or invent alternative furniture.",
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
    "- Lighting: bright neutral midday daylight — NOT golden hour, NOT evening, NOT sunset",
    `- Every piece of furniture listed MUST be present and sized correctly: the room is ${lengthM}m × ${widthM}m × ${ceilingM}m — items that are 2m wide should look 2m wide relative to the walls`,
    "- Camera: photographer standing IN THE DOORFRAME looking straight into the room — show the full room depth from entrance to far wall",
    "- LEFT wall features appear on the LEFT of the image. RIGHT wall features appear on the RIGHT. Do not mirror.",
    "- No text, watermarks, floor-plan overlays, or labels in the image",
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
