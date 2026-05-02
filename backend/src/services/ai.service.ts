import { config } from "../config/index.js";
import {
  generateRoomImage as geminiGenerateRoomImage,
  placeholderBuffer,
  type ProductForPrompt,
  type RoomDimensionsMm,
} from "../lib/gemini.js";

// ── Interface ──────────────────────────────────────────────────────────────────

export type GenerateRoomImageOpts = {
  userPrompt: string;
  products: ProductForPrompt[];
  room: RoomDimensionsMm;
};

export interface AIService {
  /** Returns a PNG buffer and a flag indicating whether a real API call was made. */
  generateRoomImage(opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }>;
}

// ── Google Gemini (current) ────────────────────────────────────────────────────

class GeminiAIService implements AIService {
  async generateRoomImage(opts: GenerateRoomImageOpts): Promise<{ buffer: Buffer; mock: boolean }> {
    return geminiGenerateRoomImage(
      { apiKey: config.ai.apiKey, model: config.ai.model, region: config.ai.region },
      opts
    );
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
