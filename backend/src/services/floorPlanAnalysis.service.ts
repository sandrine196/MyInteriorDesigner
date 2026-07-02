import { GoogleGenAI } from "@google/genai";
import { config } from "../config/index.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoomOpening {
  description: string;
  type: "door" | "window" | "patio_doors" | "french_doors" | "bifold_doors";
  approximateWidthM?: number;
  wall?: string;
  isGlazed?: boolean;
  keepClearCm?: number;
  isLightSource?: boolean;
}

export interface SpecialFeature {
  description: string;
  type: "fireplace" | "chimney_breast" | "staircase" | "alcove" | "built_in_storage" | "radiator" | "other";
  wall?: string;
  corner?: string;
  approximateSize?: string;
  keepClearCm?: number;
  isFocalPoint?: boolean;
}

export interface FloorPlanAnalysis {
  overallDescription: string;
  shapeDescription: string;
  dimensions: {
    lengthM: number;
    widthM: number;
    printedMeasurements: string;
    imperialMeasurements?: string;
    usableAreaM2: number;
  };
  openings: RoomOpening[];
  specialFeatures: SpecialFeature[];
  lightingSources: string[];
  furniturePlacementNotes: string[];
  recommendedCamera: {
    shootFromWall: string;
    facingWall: string;
    focalPoint: string;
    reasoning: string;
  };
  limitations: string;
  confidence: number;
  wallAnalysis?: Record<string, string>;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const PROMPT = `You are an expert architectural floor plan analyser specialising in UK residential properties.

Analyse this floor plan image and return structured JSON. This may be an estate agent plan, architect's drawing, or hand-drawn sketch — handle any style generically.

YOUR JOB:
1. Describe what you actually see — don't force features into rigid categories
2. Extract any printed dimensions (metric or imperial)
3. Identify all openings: doors, windows, patio doors, French doors, bi-fold doors
4. Note any special features: fireplace, chimney breast, staircase, alcoves, built-in storage
5. Determine the best camera position for an interior photograph
6. List practical furniture placement constraints
7. For each compass direction, describe what is on that wall in "wallAnalysis"

WALL DETECTION RULES:
- Walls are THICK BLACK LINES — thin lines are furniture, hatching, or annotation
- Dashed or dotted lines indicate above-ceiling features or thresholds — NOT solid walls
- Door openings appear as breaks in thick wall lines, often with a swing arc
- Window openings appear as breaks in thick wall lines with thin parallel lines across the gap
- The outermost thick lines define the room perimeter; interior thick lines = chimney breasts or load-bearing walls

RETURN EXACTLY THIS JSON (no markdown code fences, no other text):

{
  "overallDescription": "A nearly square Victorian reception room with an angular bay window on the front wall, sliding patio doors to the rear garden, and a traditional fireplace with chimney breast on the right wall. The room has a staircase intrusion in the south-east corner.",
  "shapeDescription": "Nearly rectangular with a bay window projection on the front wall and a staircase cut-out in the south-east corner",
  "dimensions": {
    "lengthM": 5.58,
    "widthM": 5.29,
    "printedMeasurements": "5.58m x 5.29m",
    "imperialMeasurements": "18'4\" x 17'4\"",
    "usableAreaM2": 26.5
  },
  "openings": [
    {
      "description": "Single hinged door, opens inward, hinged on left side, leads to hallway",
      "type": "door",
      "approximateWidthM": 0.9,
      "wall": "south",
      "isGlazed": false,
      "keepClearCm": 90,
      "isLightSource": false
    },
    {
      "description": "Sliding patio doors spanning most of the rear wall, floor-to-ceiling glazing, leads to garden",
      "type": "patio_doors",
      "approximateWidthM": 2.4,
      "wall": "north",
      "isGlazed": true,
      "keepClearCm": 150,
      "isLightSource": true
    },
    {
      "description": "Angular bay window, three panels, on front wall — large source of natural daylight",
      "type": "window",
      "approximateWidthM": 1.8,
      "wall": "west",
      "isGlazed": true,
      "keepClearCm": 0,
      "isLightSource": true
    }
  ],
  "specialFeatures": [
    {
      "description": "Traditional chimney breast with fireplace, approximately 1.5m wide, centred on east wall. Creates alcoves on either side.",
      "type": "fireplace",
      "wall": "east",
      "approximateSize": "1.5m wide × 0.3m deep",
      "keepClearCm": 100,
      "isFocalPoint": true
    },
    {
      "description": "Staircase intrusion in south-east corner, approximately 1.2m × 1.0m rectangular cut-out of usable floor area",
      "type": "staircase",
      "corner": "south-east",
      "approximateSize": "1.2m × 1.0m",
      "keepClearCm": 0,
      "isFocalPoint": false
    }
  ],
  "lightingSources": [
    "Angular bay window on west wall — large natural daylight source flooding in from the side",
    "Sliding patio doors on north wall — extensive rear glazing, very bright source from the far direction"
  ],
  "furniturePlacementNotes": [
    "Keep 100cm clear in front of the fireplace on the east wall",
    "Keep 150cm clear in front of the sliding patio doors for garden access",
    "Do not place furniture in or near the south-east staircase corner — this area is not usable floor space",
    "Seating group should face the fireplace as the primary focal point",
    "Alcoves either side of the chimney breast suit built-in shelving or cabinets"
  ],
  "recommendedCamera": {
    "shootFromWall": "south wall (entrance door)",
    "facingWall": "north-east (toward fireplace with patio doors visible beyond)",
    "focalPoint": "fireplace on east wall",
    "reasoning": "Standing at the entrance on the south wall gives the widest view. Angling slightly toward the fireplace makes it the focal point, while the patio doors behind provide natural backlighting and depth."
  },
  "limitations": "Staircase dimensions are estimated — no scale bar visible. Bay window projection depth not printed.",
  "confidence": 0.82,
  "wallAnalysis": {
    "north": "Rear wall: sliding patio doors spanning most of the wall with floor-to-ceiling glazing leading to garden",
    "south": "Front wall: angular bay window plus entrance door to hallway",
    "east": "Right wall: traditional chimney breast with fireplace, alcoves either side",
    "west": "Left wall: plain plasterwork, no openings"
  }
}

RULES:
- Return ONLY the JSON — no markdown fences, no preamble, no trailing text
- Set dimensions to 0 if not determinable; set confidence accordingly
- Confidence: 0.9+ = dimensions printed and clear; 0.7–0.9 = well-inferred; 0.5–0.7 = uncertain; <0.5 = very unclear or hand-drawn
- usableAreaM2: subtract staircase/built-in footprints; add bay window projection area
- Describe each opening and feature in plain English — be specific about what you observe
- Include EVERY window, door, and glazed opening in "openings" — even small ones
- Mark every opening or feature that needs furniture kept clear with a keepClearCm value
- List all constraints in furniturePlacementNotes — the AI rendering engine reads these directly
- lightingSources: one entry per glazed opening that admits natural light, describing its location and character
- wallAnalysis: describe each compass wall in plain English — what features are on it, its length, any openings
- If you cannot determine something, say so in "limitations" and lower confidence
- North = top of the image unless labelled otherwise`;

// ── Fallback ──────────────────────────────────────────────────────────────────

const FALLBACK: FloorPlanAnalysis = {
  overallDescription: "Unable to analyse floor plan — please enter room details manually",
  shapeDescription: "Unknown",
  dimensions: {
    lengthM: 0,
    widthM: 0,
    printedMeasurements: "Unable to read",
    usableAreaM2: 0,
  },
  openings: [],
  specialFeatures: [],
  lightingSources: [],
  furniturePlacementNotes: [],
  recommendedCamera: {
    shootFromWall: "entrance wall",
    facingWall: "far wall",
    focalPoint: "far wall",
    reasoning: "Default position — analysis failed",
  },
  limitations: "Analysis failed — please enter dimensions and room details manually",
  confidence: 0,
  wallAnalysis: {},
};

// ── Analysis model — separate from the image-generation model ─────────────────
// "gemini-flash-latest" tracks the current Flash release so a model
// retirement can't silently break floor-plan analysis again (gemini-2.0-flash
// was retired by Google and 404'd for weeks before anyone noticed).
const ANALYSIS_MODEL = "gemini-flash-latest";
const INTERPRETATION_MODEL = "gemini-flash-latest";

const INTERPRETATION_PROMPT = `You are an expert interior designer and architectural analyst. You are looking at a floor plan image.

Your job is to produce a rich, plain-English description of this room that will be used to generate a photorealistic interior render. Be specific and detailed — this description replaces the need to look at the floor plan during rendering.

Describe:
1. ROOM SHAPE: Is it a simple rectangle? If not, describe all nooks, alcoves, recesses, bay window projections, chimney breasts, and staircase cut-outs precisely. Say which corner or wall they occur on.
2. WALLS: For each wall (north/south/east/west or left/right/far/entrance), describe what is on it: windows, doors, fireplaces, alcoves, plain plasterwork. Include approximate widths.
3. NATURAL LIGHT: Where does light enter? Which direction? Large glazed areas (patio doors, floor-to-ceiling windows, bay windows) should be called out prominently.
4. ACCESS ZONES: Note any doors that need clear space — especially patio/garden doors which need 150cm clear in front.
5. ARCHITECTURAL CHARACTER: Period features, ceiling height impression, proportions, any unusual features.
6. CAMERA POSITION RECOMMENDATION: From which corner or wall should the render camera be positioned to show the room to best advantage? What should be the focal point?

Write in continuous prose, 150–250 words. Be concrete and specific — "angular bay window approximately 1.8m wide projecting 0.5m on the south wall" is better than "a bay window".`;

// ── Interpretation export (plain-text rich description for render prompts) ────

export async function interpretFloorPlan(
  imageBuffer: Buffer,
  mimeType: string = "image/webp",
): Promise<string | null> {
  if (!config.ai.apiKey) {
    console.log("[FloorPlanInterpretation] No Gemini API key — skipping");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.ai.apiKey });
    const base64 = imageBuffer.toString("base64");

    const response = await ai.models.generateContent({
      model: INTERPRETATION_MODEL,
      contents: [
        { text: INTERPRETATION_PROMPT },
        { inlineData: { mimeType, data: base64 } },
      ],
    });

    const result = response.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? null;
    if (result) console.log("[FloorPlanInterpretation] Done:", result.substring(0, 120) + "...");
    return result;
  } catch (err) {
    console.error("[FloorPlanInterpretation] Failed — proceeding without it:", err);
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeFloorPlan(
  imageBuffer: Buffer,
  mimeType: string = "image/webp",
): Promise<FloorPlanAnalysis> {
  if (!config.ai.apiKey) {
    console.log("[FloorPlanAnalysis] No Gemini API key — skipping analysis");
    return { ...FALLBACK, limitations: "No AI key configured — enter dimensions manually" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.ai.apiKey });
    const base64 = imageBuffer.toString("base64");

    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: [
        { text: PROMPT },
        { inlineData: { mimeType, data: base64 } },
      ],
    });

    const raw = response.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text ?? "";
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(cleaned) as FloorPlanAnalysis;

    console.log("[FloorPlanAnalysis] Done:", {
      confidence: analysis.confidence,
      openings: analysis.openings.length,
      specialFeatures: analysis.specialFeatures.length,
      dimensions: analysis.dimensions,
    });

    return analysis;
  } catch (err) {
    console.error("[FloorPlanAnalysis] Failed:", err);
    return FALLBACK;
  }
}
