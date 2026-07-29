import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { prisma } from "../lib/prisma.js";
import { config } from "../config/index.js";

// ── Product reference-image screening ────────────────────────────────────────
// Gemini rejects an ENTIRE render request if any attached image trips its
// safety filter, so a single unlucky catalogue photo (e.g. a framed
// figure-study art print) can break every render that selects it. We probe
// each photo once and flag the offenders; flagged products still appear in
// shopping lists, they just never get sent as a visual reference.

const PROBE_TEXT = "Photorealistic interior photograph of a bright living room, daylight.";

async function isBlocked(imageUrl: string): Promise<boolean | null> {
  if (!config.ai.apiKey) return null;
  let data: string;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    data = (await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()).toString("base64");
  } catch {
    return null; // unreachable image — nothing to judge
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.ai.apiKey });
    const res = await ai.models.generateContent({
      model: config.ai.model,
      contents: [{ text: PROBE_TEXT }, { inlineData: { mimeType: "image/jpeg", data } }] as never,
      config: { responseModalities: ["IMAGE"], temperature: 0.3 },
    });
    if (res.candidates?.[0]?.content?.parts?.some((p) => p.inlineData?.data)) return false;
    return !!res.promptFeedback?.blockReason;
  } catch {
    return null; // transient API failure — don't penalise the product
  }
}

/** Screen products imported within the last `sinceHours` hours. */
export async function screenRecentProductImages(sinceHours = 26): Promise<{ screened: number; blocked: number }> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const products = await prisma.product.findMany({
    where: { createdAt: { gte: since }, referenceImageBlocked: false, imageUrl: { not: "" } },
    select: { id: true, title: true, imageUrl: true },
  });
  if (products.length === 0) return { screened: 0, blocked: 0 };

  console.log(`[ImageScreening] Checking ${products.length} newly imported product image(s)`);
  let screened = 0, blocked = 0;
  for (const p of products) {
    const result = await isBlocked(p.imageUrl);
    if (result === null) continue;
    screened++;
    if (result) {
      await prisma.product.update({ where: { id: p.id }, data: { referenceImageBlocked: true } });
      blocked++;
      console.log(`[ImageScreening] Blocked reference image: "${p.title}"`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`[ImageScreening] Done — screened:${screened} blocked:${blocked}`);
  return { screened, blocked };
}
