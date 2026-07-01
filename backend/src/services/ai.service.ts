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
  /** Which camera angle to render. Defaults to "primary". Secondary is generated on demand. */
  cameraAngle?: "primary" | "secondary";
} & PromptMeta;

export interface AIService {
  generateRoomImage(opts: GenerateRoomImageOpts): Promise<{
    buffer: Buffer;
    floorPlanInterpretation?: string | null;
    mock: boolean;
    promptTokens: number;
    candidateTokens: number;
  }>;
}

// ── Google Gemini (Gemini Vision interpretation + direct floor plan injection) ──

class GeminiAIService implements AIService {
  async generateRoomImage(opts: GenerateRoomImageOpts): Promise<{
    buffer: Buffer;
    floorPlanInterpretation?: string | null;
    mock: boolean;
    promptTokens: number;
    candidateTokens: number;
  }> {
    let floorPlan: { data: string; mimeType: string } | null = null;
    let floorPlanInterpretation: string | null = null;

    if (opts.floorPlanKey) {
      const mimeType = opts.floorPlanKey.endsWith(".webp") ? "image/webp" : "image/jpeg";

      // Step A: Download floor plan once, then interpret it.
      const imageBuffer = await storage.download(opts.floorPlanKey).catch((err) => {
        console.error("[Gemini] Failed to load floor plan image:", err);
        return null;
      });
      const interpretation = imageBuffer
        ? await interpretFloorPlan(imageBuffer, mimeType).catch((err) => {
            console.error("[Gemini] Failed to interpret floor plan:", err);
            return null;
          })
        : null;

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

    // Step B: Generate only the requested camera angle.
    // The secondary angle is generated on demand (separate request) rather than
    // eagerly alongside every primary render — halves AI cost and storage.
    const result = await geminiGenerateRoomImage(geminiCfg, {
      ...sharedOpts,
      cameraAngle: opts.cameraAngle ?? "primary",
    });

    return {
      buffer:               result.buffer,
      floorPlanInterpretation,
      mock:                 result.mock,
      promptTokens:         result.promptTokens,
      candidateTokens:      result.candidateTokens,
    };
  }
}

// ── Mock (fast placeholder for development/testing) ────────────────────────────

class MockAIService implements AIService {
  async generateRoomImage(_opts: GenerateRoomImageOpts): Promise<{
    buffer: Buffer;
    floorPlanInterpretation?: string | null;
    mock: boolean;
    promptTokens: number;
    candidateTokens: number;
  }> {
    const buf = await placeholderBuffer();
    return { buffer: buf, mock: true, promptTokens: 0, candidateTokens: 0 };
  }
}

// ── Stability AI (future — UK-based alternative) ───────────────────────────────
// Install: npm install stability-client  or use their REST API directly.
// Useful if Gemini is unavailable in a specific region.

class StabilityAIService implements AIService {
  async generateRoomImage(_opts: GenerateRoomImageOpts): Promise<{
    buffer: Buffer;
    floorPlanInterpretation?: string | null;
    mock: boolean;
    promptTokens: number;
    candidateTokens: number;
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
