import { config } from "../config/index.js";
import { storage } from "./storage.service.js";
import {
  generateRoomImage as geminiGenerateRoomImage,
  placeholderBuffer,
  type ProductForPrompt,
  type RoomDimensionsMm,
  type PromptMeta,
} from "../lib/gemini.js";
import { interpretFloorPlan } from "./floorPlanAnalysis.service.js";

// ── Interface ──────────────────────────────────────────────────────────────────

export type GenerateRoomImageOpts = {
  userPrompt: string;
  products: ProductForPrompt[];
  room: RoomDimensionsMm;
  /** Storage key of the uploaded floor plan. Passed to interpretFloorPlan() for Gemini Vision analysis. */
  floorPlanKey?: string | null;
} & PromptMeta;

export interface AIService {
  generateRoomImage(opts: GenerateRoomImageOpts): Promise<{
    buffer: Buffer;
    alternativeBuffer?: Buffer;
    floorPlanInterpretation?: string | null;
    mock: boolean;
  }>;
}

// ── Google Gemini (Gemini Vision interpretation + direct floor plan injection) ──

class GeminiAIService implements AIService {
  async generateRoomImage(opts: GenerateRoomImageOpts): Promise<{
    buffer: Buffer;
    alternativeBuffer?: Buffer;
    floorPlanInterpretation?: string | null;
    mock: boolean;
  }> {
    let floorPlan: { data: string; mimeType: string } | null = null;
    let floorPlanInterpretation: string | null = null;

    if (opts.floorPlanKey) {
      const mimeType = opts.floorPlanKey.endsWith(".webp") ? "image/webp" : "image/jpeg";

      // Step A: Download floor plan + run Gemini interpretation in parallel.
      const [imageBuffer, interpretation] = await Promise.all([
        storage.download(opts.floorPlanKey).catch((err) => {
          console.error("[Gemini] Failed to load floor plan image:", err);
          return null;
        }),
        storage.download(opts.floorPlanKey).then((buf) => {
          return interpretFloorPlan(buf, mimeType);
        }).catch((err) => {
          console.error("[Gemini] Failed to interpret floor plan:", err);
          return null;
        }),
      ]);

      if (imageBuffer) {
        floorPlan = { data: imageBuffer.toString("base64"), mimeType };
        console.log(`[Gemini] Floor plan loaded for direct injection: ${opts.floorPlanKey}`);
      }
      floorPlanInterpretation = interpretation;

      if (floorPlanInterpretation) {
        console.log("[Gemini] Two-step render: floor plan interpretation ready");
      }
    }

    const sharedOpts = { ...opts, floorPlan, floorPlanInterpretation };
    const geminiCfg  = { apiKey: config.ai.apiKey, model: config.ai.model, region: config.ai.region };

    // Step B: Generate primary + secondary renders in parallel.
    const [primary, secondary] = await Promise.all([
      geminiGenerateRoomImage(geminiCfg, { ...sharedOpts, cameraAngle: "primary" }),
      geminiGenerateRoomImage(geminiCfg, { ...sharedOpts, cameraAngle: "secondary" }).catch((err) => {
        console.error("[Gemini] Secondary render failed — returning primary only:", err);
        return null;
      }),
    ]);

    return {
      buffer:               primary.buffer,
      alternativeBuffer:    secondary?.buffer ?? undefined,
      floorPlanInterpretation,
      mock:                 primary.mock,
    };
  }
}

// ── Mock (fast placeholder for development/testing) ────────────────────────────

class MockAIService implements AIService {
  async generateRoomImage(_opts: GenerateRoomImageOpts): Promise<{
    buffer: Buffer;
    alternativeBuffer?: Buffer;
    floorPlanInterpretation?: string | null;
    mock: boolean;
  }> {
    const buf = await placeholderBuffer();
    return { buffer: buf, alternativeBuffer: buf, mock: true };
  }
}

// ── Stability AI (future — UK-based alternative) ───────────────────────────────
// Install: npm install stability-client  or use their REST API directly.
// Useful if Gemini is unavailable in a specific region.

class StabilityAIService implements AIService {
  async generateRoomImage(_opts: GenerateRoomImageOpts): Promise<{
    buffer: Buffer;
    alternativeBuffer?: Buffer;
    floorPlanInterpretation?: string | null;
    mock: boolean;
  }> {
    throw new Error(
      "Stability AI provider not yet implemented. Set AI_PROVIDER=gemini or AI_PROVIDER=mock."
    );
  }
}

// ── Factory + singleton ────────────────────────────────────────────────────────

function createAIService(): AIService {
  if (config.ai.useMock) return new MockAIService();
  switch (config.ai.provider) {
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
