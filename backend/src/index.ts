import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import cron from "node-cron";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyJwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyError } from "fastify";
import { env, config } from "./config/index.js";
import { prisma } from "./lib/prisma.js";
import { countSuccessfulRendersThisMonth } from "./lib/usage.js";
import { runCleanup } from "./lib/cleanup.js";
import { authRoutes } from "./routes/auth.js";
import { productRoutes } from "./routes/products.js";
import { projectRoutes } from "./routes/projects.js";
import { adminRoutes } from "./routes/admin.js";
import { agentRoutes } from "./routes/agents.js";
import { backupDatabase } from "./scripts/backup.js";
import { importRaftProducts } from "./services/cjApi.service.js";

const isProd = config.env === "production";

const app = Fastify({
  logger: {
    level: isProd ? "warn" : "info",
    // Never log Authorization headers or request bodies
    redact: ["req.headers.authorization", "req.body.password"],
  },
});

// ── Security headers ──────────────────────────────────────────────────────────
await app.register(helmet, {
  // Allow images from our own domain + CDN origins used in the landing page
  contentSecurityPolicy: false,
});

// ── Compression ───────────────────────────────────────────────────────────────
await app.register(compress, { global: true });

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = new Set([
  "https://myinteriordesigner.co.uk",
  "https://www.myinteriordesigner.co.uk",
  "https://my-interior-designer.vercel.app", // keep during transition
  env.FRONTEND_URL,
  ...(env.EXTRA_ORIGINS ? env.EXTRA_ORIGINS.split(",").map((s) => s.trim()) : []),
].filter(Boolean));

await app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed`), false);
  },
  credentials: true,
});

// ── Rate limiting (global: 100 req/min per IP) ────────────────────────────────
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  errorResponseBuilder: (_req, context) => ({
    error: `Too many requests. Limit: ${context.max} per minute.`,
    code: "RATE_LIMIT",
    retryAfter: context.ttl,
  }),
});

// ── File uploads (5 MB cap) ───────────────────────────────────────────────────
await app.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── JWT (7-day tokens) ────────────────────────────────────────────────────────
await app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
  sign: { expiresIn: "7d" },
});

// ── Auth middleware ───────────────────────────────────────────────────────────
app.decorate(
  "authenticate",
  async function authenticate(request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  }
);

app.decorate(
  "authenticateAdmin",
  async function authenticateAdmin(request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    if (!request.user.isAdmin) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  }
);

app.decorate(
  "authenticateAgent",
  async function authenticateAgent(request, reply) {
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Agent authentication required" });
    }
    try {
      const payload = app.jwt.verify(auth.slice(7)) as Record<string, unknown>;
      if (payload.type !== "agent_session") throw new Error("Not an agent session token");
      request.agentSession = payload as import("./types/fastify.js").AgentSessionPayload;
    } catch {
      return reply.status(401).send({ error: "Invalid or expired session — please sign in again" });
    }
  }
);

// ── Error handler: hide stack traces in production ───────────────────────────
app.setErrorHandler((err: FastifyError, _req, reply) => {
  const status = err.statusCode ?? 500;
  if (status >= 500) {
    app.log.error(err);
    return reply.status(status).send({
      error: isProd ? "Internal server error" : err.message,
    });
  }
  // 4xx — safe to surface the message (Fastify/Zod validation errors, etc.)
  return reply.status(status).send({ error: err.message });
});

// ── Static file serving ───────────────────────────────────────────────────────
const uploadsRoot = join(process.cwd(), "uploads");
await mkdir(uploadsRoot, { recursive: true });
await mkdir(join(uploadsRoot, "floor-plans"), { recursive: true });
await mkdir(join(uploadsRoot, "renders"), { recursive: true });

await app.register(fastifyStatic, {
  root: uploadsRoot,
  prefix: "/uploads/",
  decorateReply: false,
  setHeaders(res) {
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    // Allow the frontend (different port/origin) to load these images in <img> tags
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/health", async () => {
  const dbOk = await prisma.$queryRaw`SELECT 1`
    .then(() => true)
    .catch(() => false);
  return {
    status: dbOk ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    region: config.region,
    version: process.env.npm_package_version ?? "dev",
    env: config.env,
    services: {
      database: dbOk ? "ok" : "error",
      storage: config.storage.provider,
      ai: config.ai.provider,
    },
  };
});

await authRoutes(app, env);
await productRoutes(app);
await projectRoutes(app, env);
await adminRoutes(app);
await agentRoutes(app);

app.get(
  "/me/usage",
  { preHandler: [app.authenticate] },
  async (request) => {
    const u = request.user as { sub: string; tier: string };
    const used = await countSuccessfulRendersThisMonth(u.sub);
    return {
      tier: u.tier,
      freeLimit: env.FREE_RENDERS_PER_MONTH,
      usedThisMonth: used,
      remaining:
        u.tier === "free"
          ? Math.max(0, env.FREE_RENDERS_PER_MONTH - used)
          : null,
    };
  }
);

// ── Cleanup job (runs at startup then every 24 h) ─────────────────────────────
async function scheduleCleanup() {
  try {
    await runCleanup();
  } catch (err) {
    app.log.error({ err }, "Cleanup job failed");
  }
}
await scheduleCleanup();
setInterval(scheduleCleanup, 24 * 60 * 60 * 1000);

// ── Daily database backup at 02:00 London time ────────────────────────────────
cron.schedule("0 2 * * *", async () => {
  app.log.info("Starting scheduled daily backup");
  try {
    const result = await backupDatabase();
    app.log.info({ result }, "Daily backup completed");
  } catch (err) {
    app.log.error({ err }, "Daily backup failed");
  }
}, { timezone: "Europe/London" });

// ── Daily Raft Furniture product import at 03:00 London time ─────────────────
cron.schedule("0 3 * * *", async () => {
  app.log.info("Starting scheduled Raft Furniture import");
  try {
    const result = await importRaftProducts();
    app.log.info({ result }, "Raft import completed");
  } catch (err) {
    app.log.error({ err }, "Raft import failed");
  }
}, { timezone: "Europe/London" });

console.log("Email config:", {
  hasResendKey: !!process.env.RESEND_API_KEY,
  resendKeyPrefix: process.env.RESEND_API_KEY?.slice(0, 10),
  emailFrom: process.env.EMAIL_FROM,
  emailProvider: process.env.EMAIL_PROVIDER ?? "(auto-detect)",
  resolvedProvider: config.email.provider,
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
