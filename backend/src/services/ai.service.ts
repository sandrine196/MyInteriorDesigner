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
  /** Storage key of the uploaded floor plan. Used by OpenAI provider for Vision pre-analysis. */
  floorPlanKey?: string | null;
} & PromptMeta;

export interface AIService {
  /** Returns a PNG buffer and a flag indicating whether a real API call was made. */
  generateRoomImage(opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }>;
}

// ── Google Gemini (current) ────────────────────────────────────────────────────

class GeminiAIService implements AIService {
  async generateRoomImage(opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }> {
    return geminiGenerateRoomImage({ apiKey: config.ai.apiKey, model: config.ai.model, region: config.ai.region }, opts);
  }
}

// ── OpenAI DALL-E 3 (with GPT-4o Vision floor plan pre-analysis) ──────────────

class OpenAIService implements AIService {
  private client: OpenAI;

  constructor() {
    if (!config.ai.openaiKey) throw new Error("OPENAI_API_KEY is not set");
    this.client = new OpenAI({ apiKey: config.ai.openaiKey });
  }

  // Step 1 — GPT-4o Vision: read the floor plan and describe the spatial layout.
  // Returns null on any failure so the render can still proceed without analysis.
  private async analyzeFloorPlan(key: string): Promise<string | null> {
    try {
      const imageBuffer = await storage.download(key);
      const base64 = imageBuffer.toString("base64");
      // Floor plans are stored as WebP; fall back to jpeg label if ever changed.
      const mime = key.endsWith(".webp") ? "image/webp" : "image/jpeg";

      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Analyze this floor plan image. Describe concisely:\n" +
                  "1. The overall room shape\n" +
                  "2. Door and window positions\n" +
                  "3. Any fixed features (fireplace, alcoves, structural elements)\n" +
                  "4. Recommended furniture placement zones that respect circulation flow\n\n" +
                  "Be specific about spatial relationships. Avoid decorative suggestions.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mime};base64,${base64}` },
              },
            ],
          },
        ],
      });

      return response.choices[0]?.message?.content?.trim() ?? null;
    } catch (err) {
      // Vision failure must not block image generation
      console.error("Floor plan analysis failed — proceeding without it:", err);
      return null;
    }
  }

  // Step 2 — DALL-E 3: generate the room image using the enriched prompt.
  async generateRoomImage(opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }> {
    // Step 1: floor plan analysis
    let floorPlanAnalysis: string | null = null;
    if (opts.floorPlanKey) {
      console.log(`[OpenAI] Analyzing floor plan: ${opts.floorPlanKey}`);
      floorPlanAnalysis = await this.analyzeFloorPlan(opts.floorPlanKey);
      console.log(`[OpenAI] Floor plan analysis ${floorPlanAnalysis ? "succeeded" : "failed/skipped"}:`);
      if (floorPlanAnalysis) console.log(floorPlanAnalysis);
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
