import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

export const RENDER_WIDTH = 1024;
export const RENDER_HEIGHT = 768;

export type ProductForPrompt = {
  title: string;
  retailer: string;
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

function buildPrompt(
  userPrompt: string,
  products: ProductForPrompt[],
  room: RoomDimensionsMm
): string {
  const lines = products.map((p) => {
    const dims =
      p.widthMm && p.depthMm && p.heightMm
        ? `${p.widthMm}×${p.depthMm}×${p.heightMm} mm (W×D×H)`
        : p.dimensionsRaw ?? "dimensions unknown";
    return `- ${p.retailer}: ${p.title} (${dims})`;
  });

  return [
    "Photorealistic interior design render of a UK home room.",
    `Output image: ${RENDER_WIDTH}×${RENDER_HEIGHT} pixels, 4:3 aspect ratio.`,
    "",
    `Room dimensions: ${(room.length / 1000).toFixed(1)} m long × ${(room.width / 1000).toFixed(1)} m wide, ${(room.ceilingHeight / 1000).toFixed(1)} m ceiling height.`,
    "",
    "Style brief:",
    userPrompt,
    "",
    "Furniture to include (real UK retail products, scale accurately to the room):",
    lines.join("\n"),
    "",
    "Render as a single photorealistic perspective interior photograph. Natural lighting. No text overlays.",
  ].join("\n");
}

/** Generate a room image using the Gemini API. Returns a PNG buffer. */
export async function generateRoomImage(
  cfg: { apiKey?: string; model: string; region?: string },
  opts: { userPrompt: string; products: ProductForPrompt[]; room: RoomDimensionsMm }
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
  const prompt = buildPrompt(opts.userPrompt, opts.products, opts.room);

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
