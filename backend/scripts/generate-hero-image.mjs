// One-off script: generate a hero image with Gemini and upload to R2.
// Usage: node --env-file=.env scripts/generate-hero-image.mjs
import { GoogleGenAI } from "@google/genai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const PROMPT =
  "A warm and cosy traditional British living room. Two deep-buttoned leather " +
  "Chesterfield sofas in rich burgundy, facing each other across a large " +
  "Persian rug on dark hardwood floors. Roaring fireplace with a carved stone " +
  "mantelpiece. Antique wooden side tables with brass table lamps casting warm " +
  "amber light. Walls lined with dark oak bookshelves. Heavy velvet curtains in " +
  "forest green framing tall sash windows. Framed oil paintings on the walls. " +
  "Fresh flowers in a crystal vase. Photorealistic interior photography, warm " +
  "colour grading, wide-angle shot showing the full room.";

const MODEL   = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-image";
const API_KEY = process.env.GEMINI_API_KEY;
const BUCKET  = process.env.R2_BUCKET_NAME;
const ENDPOINT = process.env.R2_ENDPOINT;
const PUBLIC_URL = process.env.STORAGE_PUBLIC_URL;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!API_KEY)   throw new Error("GEMINI_API_KEY not set");
if (!BUCKET)    throw new Error("R2_BUCKET_NAME not set");
if (!ENDPOINT)  throw new Error("R2_ENDPOINT not set");
if (!ACCESS_KEY) throw new Error("R2_ACCESS_KEY_ID not set");
if (!SECRET_KEY) throw new Error("R2_SECRET_ACCESS_KEY not set");

console.log(`Generating image with model: ${MODEL}…`);

const ai = new GoogleGenAI({ apiKey: API_KEY });
const response = await ai.models.generateContent({
  model: MODEL,
  contents: PROMPT,
  config: { responseModalities: ["IMAGE"] },
});

const parts = response.candidates?.[0]?.content?.parts ?? [];
let imageBase64;
for (const part of parts) {
  if (part.inlineData?.data) { imageBase64 = part.inlineData.data; break; }
}
if (!imageBase64) throw new Error("Gemini returned no image data");

console.log("Image generated. Uploading to R2…");

const buffer = Buffer.from(imageBase64, "base64");
const key    = "assets/hero-cosy-traditional-living-room.jpg";

const s3 = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

await s3.send(new PutObjectCommand({
  Bucket: BUCKET,
  Key: key,
  Body: buffer,
  ContentType: "image/jpeg",
  CacheControl: "public, max-age=31536000",
}));

const url = `${PUBLIC_URL}/${key}`;
console.log("\nDone! Public URL:");
console.log(url);
