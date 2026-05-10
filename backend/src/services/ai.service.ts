import OpenAI from "openai";
import sharp from "sharp";
import { config } from "../config/index.js";
import { storage } from "./storage.service.js";
import {
  generateRoomImage as geminiGenerateRoomImage,
  placeholderBuffer,
  buildPrompt,
  RENDER_WIDTH,
  RENDER_HEIGHT,
  type ProductForPrompt,
  type RoomDimensionsMm,
  type PromptMeta,
} from "../lib/gemini.js";

// ── Interface ──────────────────────────────────────────────────────────────────

export type GenerateRoomImageOpts = {
  userPrompt: string;
  products: ProductForPrompt[];
  room: RoomDimensionsMm;
  /** Storage key of the uploaded floor plan. Analysed via GPT-4o Vision before generation (requires OPENAI_API_KEY). */
  floorPlanKey?: string | null;
} & PromptMeta;

export interface AIService {
  /** Returns a PNG buffer and a flag indicating whether a real API call was made. */
  generateRoomImage(opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }>;
}

// ── Shared: GPT-4o Vision floor plan analysis ─────────────────────────────────
// Returns null if the OpenAI key is absent or the call fails — never blocks generation.

async function analyzeFloorPlanWithVision(client: OpenAI, key: string, tag: string): Promise<string | null> {
  try {
    const imageBuffer = await storage.download(key);
    const base64 = imageBuffer.toString("base64");
    const mime = key.endsWith(".webp") ? "image/webp" : "image/jpeg";

    console.log(`[${tag}] Analyzing floor plan with GPT-4o Vision: ${key}`);

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this floor plan and describe the spatial layout from the doorway perspective.\n\n" +
                "STEP 1 — FIND THE ENTRANCE DOOR:\n" +
                "Look for a curved door swing arc (quarter-circle line), an inward-pointing arrow, or a threshold gap in the wall. " +
                "This is the main entrance. Do NOT use interior doors. Note where it sits on its wall.\n\n" +
                "STEP 2 — STAND IN THE DOORWAY:\n" +
                "Mentally place yourself IN that doorway, facing INTO the room. " +
                "Now describe exactly what is in each direction using LEFT/RIGHT/AHEAD/BEHIND — NOT wall names like 'bottom wall':\n" +
                "- On your LEFT: [what is there]\n" +
                "- On your RIGHT: [what is there]\n" +
                "- STRAIGHT AHEAD (opposite wall): [what is there]\n" +
                "- BEHIND YOU / same wall as door: [what is there beside the entrance]\n\n" +
                "STEP 3 — LABEL EVERY FEATURE WITH A DIRECTION:\n" +
                "For each window, bay window, fireplace, alcove or feature write it as:\n" +
                "  'Bay window on the RIGHT when entering'\n" +
                "  'Fireplace on the wall STRAIGHT AHEAD'\n" +
                "  'Window on the LEFT wall, mid-point'\n" +
                "Never use vague terms like 'bottom wall' or 'top-left' — always use LEFT / RIGHT / AHEAD / BEHIND.\n\n" +
                "STEP 4 — ARCHITECTURAL FEATURES:\n" +
                "- Fireplaces: marked 'CH', rectangular recess, or noticeably thicker wall section\n" +
                "- Bay windows: project outward beyond the wall line\n" +
                "- Alcoves, built-ins, kitchen or bathroom fixtures\n\n" +
                "STEP 5 — FURNITURE PLACEMENT:\n" +
                "Recommend zones using the same LEFT/RIGHT/AHEAD language, respecting the door swing, window light, and any fireplace wall.\n\n" +
                "Double-check your LEFT and RIGHT before finalising — they depend entirely on which direction the door faces.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ],
    });

    const result = response.choices[0]?.message?.content?.trim() ?? null;
    console.log(`[${tag}] Floor plan analysis ${result ? "succeeded" : "returned empty"}:`);
    if (result) console.log(result);
    return result;
  } catch (err) {
    console.error(`[${tag}] Floor plan analysis failed — proceeding without it:`, err);
    return null;
  }
}

// ── Google Gemini (GPT-4o Vision pre-analysis + direct floor plan injection) ───

class GeminiAIService implements AIService {
  private openai: OpenAI | null = config.ai.openaiKey
    ? new OpenAI({ apiKey: config.ai.openaiKey })
    : null;

  async generateRoomImage(opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }> {
    let floorPlan: { data: string; mimeType: string } | null = null;
    let floorPlanAnalysis: string | null = null;

    if (opts.floorPlanKey) {
      const mimeType = opts.floorPlanKey.endsWith(".webp") ? "image/webp" : "image/jpeg";

      if (!this.openai) {
        console.log("[Gemini] OPENAI_API_KEY not set — skipping Vision pre-analysis");
      }

      // Download the floor plan image and run GPT-4o Vision analysis in parallel.
      const [imageBuffer, analysis] = await Promise.all([
        storage.download(opts.floorPlanKey).catch((err) => {
          console.error("[Gemini] Failed to load floor plan image:", err);
          return null;
        }),
        this.openai
          ? analyzeFloorPlanWithVision(this.openai, opts.floorPlanKey, "Gemini")
          : Promise.resolve(null),
      ]);

      if (imageBuffer) {
        floorPlan = { data: imageBuffer.toString("base64"), mimeType };
        console.log(`[Gemini] Floor plan loaded for direct injection: ${opts.floorPlanKey}`);
      }
      floorPlanAnalysis = analysis;
    }

    return geminiGenerateRoomImage(
      { apiKey: config.ai.apiKey, model: config.ai.model, region: config.ai.region },
      { ...opts, floorPlan, floorPlanAnalysis },
    );
  }
}

// ── OpenAI DALL-E 3 (with GPT-4o Vision floor plan pre-analysis) ──────────────

class OpenAIService implements AIService {
  private client: OpenAI;

  constructor() {
    if (!config.ai.openaiKey) throw new Error("OPENAI_API_KEY is not set");
    this.client = new OpenAI({ apiKey: config.ai.openaiKey });
  }

  async generateRoomImage(opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }> {
    let floorPlanAnalysis: string | null = null;
    if (opts.floorPlanKey) {
      floorPlanAnalysis = await analyzeFloorPlanWithVision(this.client, opts.floorPlanKey, "OpenAI");
    } else {
      console.log("[OpenAI] No floor plan key — skipping Vision analysis");
    }

    const prompt = buildPrompt(opts.userPrompt, opts.products, opts.room, {
      projectName:      opts.projectName,
      designStyle:      opts.designStyle,
      wallColorPalette: opts.wallColorPalette,
      flooringType:     opts.flooringType,
      floorPlanAnalysis,
    });

    console.log("[OpenAI] Final DALL-E 3 prompt:\n" + prompt);

    const response = await this.client.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "natural",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error("DALL-E 3 returned no image URL");

    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to download DALL-E image: ${res.status}`);

    const arrayBuffer = await res.arrayBuffer();
    const buffer = await sharp(Buffer.from(arrayBuffer))
      .resize(RENDER_WIDTH, RENDER_HEIGHT, { fit: "cover" })
      .png()
      .toBuffer();

    return { buffer, mock: false };
  }
}

// ── Mock (fast placeholder for development/testing) ────────────────────────────

class MockAIService implements AIService {
  async generateRoomImage(_opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }> {
    return { buffer: await placeholderBuffer(), mock: true };
  }
}

// ── Stability AI (future — UK-based alternative) ───────────────────────────────
// Install: npm install stability-client  or use their REST API directly.
// Useful if Gemini is unavailable in a specific region.

class StabilityAIService implements AIService {
  async generateRoomImage(_opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }> {
    // TODO: call https://api.stability.ai/v2beta/stable-image/generate/ultra
    throw new Error(
      "Stability AI provider not yet implemented. Set AI_PROVIDER=gemini or AI_PROVIDER=mock."
    );
  }
}

// ── Factory + singleton ────────────────────────────────────────────────────────

function createAIService(): AIService {
  if (config.ai.useMock) return new MockAIService();
  switch (config.ai.provider) {
    case "openai":
      return new OpenAIService();
    case "stability":
      return new StabilityAIService();
    case "mock":
      return new MockAIService();
    case "gemini":
    default:
      return new GeminiAIService();
  }
}

export const aiService: AIService = createAIService();
