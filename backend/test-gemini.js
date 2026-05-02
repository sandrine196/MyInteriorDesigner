import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env ────────────────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(join(dir, ".env"), "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  env[key] = val;
}

const apiKey = env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌  GEMINI_API_KEY not found in .env");
  process.exit(1);
}
console.log("✅  GEMINI_API_KEY loaded\n");

const ai = new GoogleGenAI({ apiKey });

// ── Step 1: List models ──────────────────────────────────────────────────────
console.log("━━━ Available models ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const pager = await ai.models.list();
const models = [];
for await (const m of pager) models.push(m);
console.log(`Total: ${models.length} models\n`);

// ── Step 2: Image-generation capable models ──────────────────────────────────
console.log("━━━ Image generation models ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const imageModels = models.filter(
  (m) =>
    m.name?.includes("imagen") ||
    m.supportedGenerationMethods?.includes("generateImages") ||
    m.name?.includes("image")
);
if (imageModels.length === 0) {
  console.log("  (none found — will still attempt generation below)");
} else {
  for (const m of imageModels) {
    const methods = m.supportedGenerationMethods?.join(", ") ?? "unknown";
    console.log(`  ${m.name}`);
    console.log(`    Display name : ${m.displayName ?? "—"}`);
    console.log(`    Methods      : ${methods}\n`);
  }
}

// ── Step 3: Generate a test image ────────────────────────────────────────────
const MODEL = env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-001";
console.log(`━━━ Generating test image with "${MODEL}" ━━━━━━━━━━━━━━━━━━━━━━━`);
console.log('  Prompt: "a red apple"\n');

try {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: "a red apple",
    config: { responseModalities: ["IMAGE"] },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let imageBytes;
  for (const part of parts) {
    if (part.inlineData?.data) { imageBytes = part.inlineData.data; break; }
  }

  if (!imageBytes) {
    console.error("❌  API responded but returned no image bytes.");
    console.log("    Full response:", JSON.stringify(response, null, 2));
    process.exit(1);
  }

  const outPath = join(dir, "test-output.png");
  writeFileSync(outPath, Buffer.from(imageBytes, "base64"));
  console.log(`✅  Image saved to: ${outPath}`);
  console.log(`    Size: ${Math.round(imageBytes.length * 0.75 / 1024)} KB`);
} catch (err) {
  console.error("❌  Generation failed:", err.message);
  if (err.status) console.error("    HTTP status:", err.status);
  process.exit(1);
}
