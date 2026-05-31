import { GoogleGenAI } from "@google/genai";
import { config } from "../config/index.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoomIrregularity {
  type: "bay_window" | "bow_window" | "staircase" | "chimney_breast" | "alcove" | "l_shape";
  wall?: "north" | "south" | "east" | "west";
  corner?: "north_east" | "north_west" | "south_east" | "south_west";
  widthM?: number;
  projectionM?: number;
  depthM?: number;
  notes?: string;
}

export interface DetectedDoor {
  wall: "north" | "south" | "east" | "west";
  type: "single" | "double_french" | "sliding_patio" | "bifold" | "pocket";
  widthM: number;
  opensInward?: boolean;
  swingsLeft?: boolean;
  slideDirection?: "left" | "right";
  positionFromLeft: number; // 0–1 ratio along the wall
  leadsTo?: "garden" | "balcony" | "hallway" | "unknown";
  isGlazed: boolean;
  floorToCeiling: boolean;
}

export interface DetectedWindow {
  wall: "north" | "south" | "east" | "west";
  type: "standard" | "bay_angular" | "bow" | "box_bay" | "floor_to_ceiling";
  widthM: number;
  positionFromLeft: number; // 0–1 ratio along the wall
}

export interface FloorPlanAnalysis {
  shape: "rectangular" | "bay_window" | "staircase_intrusion" | "l_shaped" | "irregular";
  irregularities: RoomIrregularity[];
  dimensions: {
    lengthM: number;
    widthM: number;
    printedMeasurements: string;
    usableAreaM2: number;
  };
  doors: DetectedDoor[];
  windows: DetectedWindow[];
  hasFireplace: boolean;
  fireplaceWall?: string | null;
  hasBuiltInStorage: boolean;
  hasStaircaseIntrusion: boolean;
  staircaseCorner?: string | null;
  recommendedCameraWall: string;
  recommendedFacingWall: string;
  focalPoint: string;
  confidence: number; // 0–1
  notes: string;
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const PROMPT = `You are an expert architectural floor plan analyser specialising in UK residential properties.

Analyse this floor plan image extremely carefully and return a JSON response.

LOOK FOR THESE SPECIFIC THINGS:

1. ROOM SHAPE — Is it a perfect rectangle? Common UK irregularities:
   - Bay windows: angled or curved projection from one wall (very common in Victorian/Edwardian properties!)
   - Staircase intrusions: rectangular cut-out usually in a corner
   - Chimney breasts: rectangular protrusion from a wall
   - Alcoves: recesses beside chimney breasts
   - L-shaped rooms: two rectangles joined

2. PRINTED DIMENSIONS
   Look carefully for numbers like "5.58m x 5.29m" or "18'4 x 17'4". These are CRITICAL — extract them exactly.

3. DOORS
   Hinged doors: gap in wall + quarter-circle arc. Arc direction shows hinge and swing.
   Sliding/patio doors: parallel lines on wall, sometimes with an arrow indicating slide direction.
   - Sliding patio doors are common on the REAR wall of UK ground-floor rooms (garden access).
   - Mark these as type "sliding_patio", leadsTo "garden" if on rear/north wall.
   - They are a MAJOR light source and should NOT be blocked by furniture.

4. WINDOWS
   Shown as thin parallel lines across wall. Bay windows project outward beyond the wall line.

5. STAIRS
   Shown as parallel lines (steps) in a rectangle, usually in a corner of the room.

6. FIREPLACE / CHIMNEY
   Marked "CH", or shown as rectangular indent/recess, or noticeably thicker wall section.
   Usually centred on one wall.

RETURN EXACTLY THIS JSON (no other text):

{
  "shape": "rectangular|bay_window|staircase_intrusion|l_shaped|irregular",
  "irregularities": [
    {
      "type": "bay_window|bow_window|staircase|chimney_breast|alcove",
      "wall": "north|south|east|west",
      "corner": "north_east|north_west|south_east|south_west",
      "widthM": 1.8,
      "projectionM": 0.6,
      "depthM": 1.5,
      "notes": "Victorian angular bay window"
    }
  ],
  "dimensions": {
    "lengthM": 5.58,
    "widthM": 5.29,
    "printedMeasurements": "5.58m x 5.29m",
    "usableAreaM2": 26.5
  },
  "doors": [
    {
      "wall": "south",
      "type": "single",
      "widthM": 0.9,
      "opensInward": true,
      "swingsLeft": false,
      "positionFromLeft": 0.5,
      "leadsTo": "hallway",
      "isGlazed": false,
      "floorToCeiling": false
    },
    {
      "wall": "north",
      "type": "sliding_patio",
      "widthM": 1.8,
      "slideDirection": "left",
      "positionFromLeft": 0.4,
      "leadsTo": "garden",
      "isGlazed": true,
      "floorToCeiling": false
    }
  ],
  "windows": [
    {
      "wall": "west",
      "type": "bay_angular",
      "widthM": 1.8,
      "positionFromLeft": 0.3
    }
  ],
  "hasFireplace": false,
  "fireplaceWall": null,
  "hasBuiltInStorage": false,
  "hasStaircaseIntrusion": true,
  "staircaseCorner": "south_east",
  "recommendedCameraWall": "south",
  "recommendedFacingWall": "north",
  "focalPoint": "bay_window",
  "confidence": 0.85,
  "notes": "Victorian reception room with bay window on west wall, sliding patio doors to garden on north wall, and staircase intrusion in south-east corner"
}

IMPORTANT RULES:
- Return ONLY the JSON, no other text
- If you cannot determine something, use null
- Confidence: 0.9+ if dimensions are printed clearly; 0.7–0.9 if you can infer well; 0.5–0.7 if uncertain; below 0.5 if very unclear
- For usableAreaM2: subtract staircase area from total, bay window projections ADD to usable area
- North = top of image (usually)
- Hand-drawn or low-resolution plans should have lower confidence`;

// ── Fallback ──────────────────────────────────────────────────────────────────

const FALLBACK: FloorPlanAnalysis = {
  shape: "rectangular",
  irregularities: [],
  dimensions: { lengthM: 0, widthM: 0, printedMeasurements: "Unable to read", usableAreaM2: 0 },
  doors: [],
  windows: [],
  hasFireplace: false,
  hasBuiltInStorage: false,
  hasStaircaseIntrusion: false,
  recommendedCameraWall: "south",
  recommendedFacingWall: "north",
  focalPoint: "main_wall",
  confidence: 0,
  notes: "Analysis failed — please enter dimensions manually",
};

// ── Analysis model — separate from the image-generation model ─────────────────
const ANALYSIS_MODEL = "gemini-2.0-flash";

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyzeFloorPlan(
  imageBuffer: Buffer,
  mimeType: string = "image/webp",
): Promise<FloorPlanAnalysis> {
  if (!config.ai.apiKey) {
    console.log("[FloorPlanAnalysis] No Gemini API key — skipping analysis");
    return { ...FALLBACK, notes: "No AI key configured — enter dimensions manually" };
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
      shape: analysis.shape,
      irregularities: analysis.irregularities.length,
      confidence: analysis.confidence,
      dimensions: analysis.dimensions,
    });

    return analysis;
  } catch (err) {
    console.error("[FloorPlanAnalysis] Failed:", err);
    return FALLBACK;
  }
}
