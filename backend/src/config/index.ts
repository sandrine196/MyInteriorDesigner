import { loadEnv } from "../env.js";

// Parse and validate required env vars once at startup.
// Re-exported as `env` for backward-compat with routes that accept (app, env).
export const env = loadEnv();

// Structured config — all regional/provider choices live here.
// Swap a deployment region with a single env var change, never a code change.
export const config = {
  env: process.env.NODE_ENV ?? "development",

  // DEPLOYMENT_REGION signals where this instance runs (UK | US | EU).
  // Used in health checks and structured logs for observability.
  region: process.env.DEPLOYMENT_REGION ?? "UK",

  server: {
    port: env.PORT,
    frontendUrl: env.FRONTEND_URL,
  },

  database: {
    url: env.DATABASE_URL,
    // Future Postgres read-replica: set DATABASE_READ_URL to distribute read load.
    readReplicaUrl: process.env.DATABASE_READ_URL ?? env.DATABASE_URL,
  },

  storage: {
    // STORAGE_PROVIDER selects the file-storage backend.
    // "local" = uploads/ on disk (current), "r2" | "s3" | "scaleway" for production.
    provider: (process.env.STORAGE_PROVIDER ?? "local") as "local" | "r2" | "s3" | "scaleway",
    region: process.env.STORAGE_REGION ?? "WEUR",
    endpoint: process.env.R2_ENDPOINT ?? process.env.S3_ENDPOINT,
    bucket: process.env.R2_BUCKET_NAME ?? process.env.S3_BUCKET_NAME,
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY,
    // Base URL for public file access (e.g. https://cdn.myinteriordesigner.co.uk).
    publicUrl: process.env.STORAGE_PUBLIC_URL,
  },

  ai: {
    // AI_PROVIDER selects the image-generation backend.
    // "gemini" = current, "stability" | "mock" for alternatives/testing.
    provider: (process.env.AI_PROVIDER ?? "gemini") as "gemini" | "stability" | "mock",
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_IMAGE_MODEL,
    // AI_REGION can route to an EU endpoint when Google makes one available.
    region: process.env.AI_REGION ?? "global",
    useMock: env.USE_MOCK_RENDER,
  },

  email: {
    alertEmail: env.ALERT_EMAIL,
    from: process.env.EMAIL_FROM ?? "hello@myinteriordesigner.co.uk",
    provider: (process.env.EMAIL_PROVIDER ?? "console") as "console" | "resend" | "smtp",
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: "7d" as const,
  },

  features: {
    // STRICT_GDPR=true enables EU-specific data handling (shorter retention, consent checks).
    strictGdpr: process.env.STRICT_GDPR === "true",
    // ENABLE_ANALYTICS=false disables event tracking (opt-out for privacy-sensitive regions).
    enableAnalytics: process.env.ENABLE_ANALYTICS !== "false",
  },

  rateLimits: {
    freeRenders: env.FREE_RENDERS_PER_MONTH,
    proRendersPerDay: env.PRO_RENDERS_PER_DAY,
    maxRendersPerHour: env.MAX_RENDERS_PER_HOUR,
    maxProjectsFree: env.MAX_PROJECTS_FREE,
    maxProjectsPro: env.MAX_PROJECTS_PRO,
    renderCooldownSeconds: env.RENDER_COOLDOWN_SECONDS,
    maxConcurrentRenders: env.MAX_CONCURRENT_RENDERS,
  },
};
