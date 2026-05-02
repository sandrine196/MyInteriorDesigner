import { config } from "../config/index.js";

// Structured JSON logger for library code (cleanup, alerts, analytics).
// Route handlers should use Fastify's built-in request logger instead.
// Output format matches Pino so log aggregators parse both consistently.

function log(level: string, message: string, meta?: Record<string, unknown>): void {
  const entry = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    region: config.region,
    ...meta,
  });
  if (level === "error" || level === "warn") {
    console.error(entry);
  } else {
    console.log(entry);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
