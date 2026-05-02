import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(dir, "../.env");

const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
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
  console.error("GEMINI_API_KEY not found in .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

console.log("Fetching available models...\n");
const pager = await ai.models.list();

const models = [];
for await (const model of pager) {
  models.push(model);
}

const imagen = models.filter((m) => m.name?.includes("imagen"));
const imageCapable = models.filter(
  (m) => !m.name?.includes("imagen") && m.supportedGenerationMethods?.includes("generateContent")
);

console.log(`Total models: ${models.length}\n`);

if (imagen.length) {
  console.log("=== Imagen models ===");
  for (const m of imagen) {
    console.log(`  ${m.name}  —  ${m.displayName ?? ""}`);
  }
  console.log();
}

console.log("=== All model names ===");
for (const m of models) {
  console.log(`  ${m.name}`);
}
