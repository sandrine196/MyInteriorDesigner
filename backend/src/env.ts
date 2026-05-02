import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_IMAGE_MODEL: z.string().default("gemini-2.5-flash-image"),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().default("http://localhost:3001"),
  FREE_RENDERS_PER_MONTH: z.coerce.number().default(5),
  PRO_RENDERS_PER_DAY: z.coerce.number().default(100),
  MAX_RENDERS_PER_HOUR: z.coerce.number().default(20),
  MAX_PROJECTS_FREE: z.coerce.number().default(10),
  MAX_PROJECTS_PRO: z.coerce.number().default(100),
  RENDER_COOLDOWN_SECONDS: z.coerce.number().default(30),
  MAX_CONCURRENT_RENDERS: z.coerce.number().default(3),
  ALERT_EMAIL: z.string().email().optional(),
  USE_MOCK_RENDER: z.string().optional().transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
