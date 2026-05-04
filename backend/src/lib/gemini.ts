import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

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

export type PromptMeta = {
  projectName?: string | null;
  designStyle?: string | null;
  wallColorPalette?: string | null;
  flooringType?: string | null;
  floorPlanAnalysis?: string | null;
};

export function buildPrompt(
  userPrompt: string,
  products: ProductForPrompt[],
  room: RoomDimensionsMm,
  meta: PromptMeta = {},
): string {
  const { projectName, designStyle, wallColorPalette, flooringType, floorPlanAnalysis } = meta;

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

  const lines: (string | null)[] = [
    `Professional interior design photograph of a ${styleLabel} ${roomType}.`,
    "",
    "ROOM SPECIFICATIONS:",
    `- Dimensions: ${lengthM}m × ${widthM}m with ${ceilingM}m ceiling height`,
    wallDesc  ? `- Walls: ${wallDesc}`     : null,
    floorDesc ? `- Flooring: ${floorDesc}` : null,
  ];

  if (products.length > 0) {
    lines.push(
      "",
      "FURNITURE (all items must be accurately scaled to room dimensions):",
      ...productLines,
    );
  }

  if (floorPlanAnalysis) {
    lines.push(
      "",
      "FLOOR PLAN ANALYSIS:",
      floorPlanAnalysis,
      "The photograph must respect this exact floor plan layout.",
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
    `- All furniture must be to scale, respecting the room's actual dimensions (${lengthM}m × ${widthM}m)`,
    "- Arrange furniture following feng shui principles to ensure optimal circulation and flow in the room",
    "- No text overlays, watermarks, labels, or visible floor plan lines",
  );

  return lines.filter((l) => l !== null).join("\n");
}

/** Generate a room image using the Gemini API. Returns a PNG buffer. */
export async function generateRoomImage(
  cfg: { apiKey?: string; model: string; region?: string },
  opts: { userPrompt: string; products: ProductForPrompt[]; room: RoomDimensionsMm } & PromptMeta
): Promise<{ buffer: Buffer; mock: boolean }> {
  if (!cfg.apiKey) {
    return { buffer: await placeholderBuffer(), mock: true };
  }

  // Route to EU endpoint when configured — placeholder for when Google exposes one.
  const baseUrl =
    cfg.region === "EU"
      ? "https://eu-generativelanguage.googleapis.com"
      : "https://generativelanguage.googleapis.com";

  const ai = new GoogleGenAI({ apiKey: cfg.apiKey, httpOptions: { baseUrl } });
  const prompt = buildPrompt(opts.userPrompt, opts.products, opts.room, {
    projectName:      opts.projectName,
    designStyle:      opts.designStyle,
    wallColorPalette: opts.wallColorPalette,
    flooringType:     opts.flooringType,
  });

  const response = await ai.models.generateContent({
    model: cfg.model,
    contents: prompt,
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
    throw new Error("Model returned no image. Check model name and API access.");
  }

  const buffer = await sharp(Buffer.from(imageBase64, "base64"))
    .resize(RENDER_WIDTH, RENDER_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();

  return { buffer, mock: false };
}
