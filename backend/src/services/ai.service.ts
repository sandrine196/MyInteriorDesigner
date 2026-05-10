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
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this floor plan in detail. Describe:\n" +
                "1. Overall room shape and dimensions\n" +
                "2. Door location and which wall it's on\n" +
                "3. Window location(s) and which wall they're on\n" +
                "4. RELATIVE POSITIONING: When standing in the doorway looking into the room, describe where the windows are (left side, right side, straight ahead, etc.)\n" +
                "5. Any architectural features: fireplaces (including covered/obfuscated ones — shown as thicker wall sections), alcoves, bay windows, built-in features\n" +
                "6. Recommended furniture placement zones that:\n" +
                "   - Respect the door and window positions\n" +
                "   - Account for natural light from windows\n" +
                "   - Leave the fireplace wall clear if one exists\n" +
                "   - Ensure good circulation flow from the door\n\n" +
                "Be VERY specific about spatial relationships — the AI needs to understand the exact layout.",
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

// ── Google Gemini (with direct floor plan image injection) ────────────────────

class GeminiAIService implements AIService {
  async generateRoomImage(opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }> {
    // Pass the floor plan image directly in the Gemini request — the model reads
    // spatial layout, window/door positions, and architectural features itself.
    let floorPlan: { data: string; mimeType: string } | null = null;
    if (opts.floorPlanKey) {
      try {
        const imageBuffer = await storage.download(opts.floorPlanKey);
        const mimeType = opts.floorPlanKey.endsWith(".webp") ? "image/webp" : "image/jpeg";
        floorPlan = { data: imageBuffer.toString("base64"), mimeType };
        console.log(`[Gemini] Floor plan loaded for direct injection: ${opts.floorPlanKey}`);
      } catch (err) {
        console.error("[Gemini] Failed to load floor plan — proceeding without it:", err);
      }
    }
    return geminiGenerateRoomImage(
      { apiKey: config.ai.apiKey, model: config.ai.model, region: config.ai.region },
      { ...opts, floorPlan },
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
