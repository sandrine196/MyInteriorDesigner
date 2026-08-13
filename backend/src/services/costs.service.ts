import { prisma } from "../lib/prisma.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataSource = "live_api" | "calculated" | "manual" | "error";

export type CostsResult = {
  period: string;
  costs: {
    gemini: number;
    reve: number;
    railway: number;
    r2: number;
    resend: number;
    vercel: number;
    total: number;
  };
  currency: "USD";
  renders: {
    total: number;
    regular: number;
    staging: number;
  };
  dataSource: {
    gemini: DataSource;
    reve: DataSource;
    railway: DataSource;
    r2: DataSource;
    resend: DataSource;
    vercel: DataSource;
  };
  errors: Record<string, string>;
  fetchedAt: string;
};

// ─── Gemini costs — token-based pricing ──────────────────────────────────────
// Token counts are captured from usageMetadata on each Gemini API response and
// stored in Render.promptTokens / Render.candidateTokens since June 2026.
// Renders before that date fall back to a flat-rate estimate.
//
// Gemini 2.5 Flash pricing (https://ai.google.dev/pricing):
//   Input:  $0.15 / 1M tokens
//   Output: $0.60 / 1M tokens

const GEMINI_INPUT_PRICE_USD  = 0.15 / 1_000_000;
const GEMINI_OUTPUT_PRICE_USD = 0.60 / 1_000_000;
const GEMINI_FLAT_RATE_USD    = 0.04; // fallback for pre-token-tracking renders

async function getGeminiCosts(
  startDate: Date, endDate: Date
): Promise<{ cost: number; source: DataSource }> {
  const renderWhere = { imageKey: { startsWith: "renders/" }, createdAt: { gte: startDate, lte: endDate } };

  const [tokenAgg, flatCount] = await Promise.all([
    // Renders with real token data
    prisma.render.aggregate({
      _sum: { promptTokens: true, candidateTokens: true },
      where: { ...renderWhere, promptTokens: { not: null } },
    }),
    // Renders before token tracking (no token data)
    prisma.render.count({
      where: { ...renderWhere, promptTokens: null },
    }),
  ]);

  const promptTokens    = tokenAgg._sum.promptTokens    ?? 0;
  const candidateTokens = tokenAgg._sum.candidateTokens ?? 0;

  const tokenCost = promptTokens * GEMINI_INPUT_PRICE_USD + candidateTokens * GEMINI_OUTPUT_PRICE_USD;
  const flatCost  = flatCount * GEMINI_FLAT_RATE_USD;
  const cost      = tokenCost + flatCost;

  // Report as live_api when we have real token data for this period
  const source: DataSource = promptTokens > 0 ? "live_api" : "calculated";
  return { cost, source };
}

// ─── Virtual staging costs — calculated from AgentStagingLog ─────────────────
// Gemini image generation has no separate per-call billing API, so we log call
// counts per staging job in AgentStagingLog and price them ourselves.
//
// Previously priced via Reve (sunset 2026-08-14); staging now runs on Gemini
// (gemini-3.1-flash-lite-image, see backend/src/lib/gemini.ts STAGING_MODEL).
// The reveStageCalls/reveClearCalls column names were kept as-is rather than
// migrated — they count Gemini staging calls now.
//
// gemini-3.1-flash-lite-image pricing: $0.0336 per image generated.

const STAGING_IMAGE_USD = 0.0336; // gemini-3.1-flash-lite-image, per image

async function getReveCosts(startDate: Date, endDate: Date): Promise<number> {
  const agg = await prisma.agentStagingLog.aggregate({
    _sum: { reveStageCalls: true, reveClearCalls: true },
    where: { createdAt: { gte: startDate, lte: endDate } },
  });
  const stageCalls = agg._sum.reveStageCalls ?? 0;
  const clearCalls = agg._sum.reveClearCalls ?? 0;
  return (stageCalls + clearCalls) * STAGING_IMAGE_USD;
}

// ─── Railway costs — Railway GraphQL API ──────────────────────────────────────
// Requires: RAILWAY_API_KEY, RAILWAY_PROJECT_ID

async function getRailwayCosts(): Promise<{ cost: number; source: DataSource; error?: string }> {
  const apiKey     = process.env.RAILWAY_API_KEY;
  const projectId  = process.env.RAILWAY_PROJECT_ID;

  if (!apiKey || !projectId) {
    return { cost: 0, source: "error", error: "RAILWAY_API_KEY or RAILWAY_PROJECT_ID not set" };
  }

  try {
    const res = await fetch("https://backboard.railway.app/graphql/v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query {
            project(id: "${projectId}") {
              estimatedUsage {
                dollars
              }
            }
          }
        `,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const json = await res.json() as {
      data?: { project?: { estimatedUsage?: { dollars?: number } } };
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      return { cost: 0, source: "error", error: json.errors[0].message };
    }

    const dollars = json.data?.project?.estimatedUsage?.dollars ?? 0;
    return { cost: dollars, source: "live_api" };
  } catch (err) {
    return { cost: 0, source: "error", error: err instanceof Error ? err.message : "Railway API failed" };
  }
}

// ─── R2 costs — estimate from S3 object list ─────────────────────────────────
// Cloudflare R2 pricing (after free tier):
//   Storage: $0.015/GB/month  (first 10 GB free)
//   Class A (writes): $4.50/million  (first 1M free)
//   Class B (reads): $0.36/million   (first 10M free)
//   Egress: FREE

async function getR2Costs(): Promise<{ cost: number; source: DataSource; error?: string }> {
  const accountId  = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    return { cost: 0, source: "error", error: "R2 env vars not set" };
  }

  try {
    const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    let totalSizeBytes = 0;
    let continuationToken: string | undefined;
    let pages = 0;

    // Page through up to 10,000 objects
    while (pages < 10) {
      const resp = await client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }));

      for (const obj of resp.Contents ?? []) {
        totalSizeBytes += obj.Size ?? 0;
      }
      pages++;
      if (!resp.IsTruncated) break;
      continuationToken = resp.NextContinuationToken;
    }

    const storageGB = totalSizeBytes / 1e9;
    const billableGB = Math.max(0, storageGB - 10); // 10 GB free
    const cost = billableGB * 0.015;

    return { cost, source: "live_api" };
  } catch (err) {
    return { cost: 0, source: "error", error: err instanceof Error ? err.message : "R2 API failed" };
  }
}

// ─── Resend costs — calculated from new users (proxy for emails sent) ─────────
// Resend charges $0.001/email after the first 3,000/month.
// We count new user registrations + password resets as email events.

const RESEND_FREE_EMAILS_PER_MONTH = 3000;
const RESEND_COST_PER_EMAIL_USD    = 0.001;

async function getResendCosts(startDate: Date, endDate: Date): Promise<number> {
  const [newUsers, passwordResets] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
    prisma.passwordResetToken.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
  ]);

  const totalEmails    = newUsers + passwordResets;
  const billableEmails = Math.max(0, totalEmails - RESEND_FREE_EMAILS_PER_MONTH);
  return billableEmails * RESEND_COST_PER_EMAIL_USD;
}

// ─── Vercel costs — read from manual CostEntry ────────────────────────────────
// Vercel billing API requires Enterprise plan. We store Vercel costs manually
// in the CostEntry table with provider = "Vercel".

async function getVercelCosts(month: number, year: number): Promise<number> {
  const entries = await prisma.costEntry.findMany({
    where: { provider: { equals: "Vercel", mode: "insensitive" }, month, year, status: "active" },
  });
  // CostEntry is in GBP, but we want USD here. Use 1.27 as approximate rate.
  const GBP_TO_USD = 1.27;
  return entries.reduce((s, e) => s + e.monthlyCostGbp * GBP_TO_USD, 0);
}

// ─── Render counts ────────────────────────────────────────────────────────────

async function getRenderCounts(startDate: Date, endDate: Date) {
  const [regular, staging] = await Promise.all([
    prisma.render.count({
      where: { imageKey: { startsWith: "renders/" }, createdAt: { gte: startDate, lte: endDate } },
    }),
    prisma.agentStagingLog.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    }),
  ]);
  return { regular, staging, total: regular + staging };
}

// ─── Master function ──────────────────────────────────────────────────────────

export async function getAllCosts(period: "month" | "week" | "today" = "month"): Promise<CostsResult> {
  const now       = new Date();
  const startDate = period === "month"
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    : period === "week"
    ? new Date(now.getTime() - 7 * 86400000)
    : new Date(new Date().setUTCHours(0, 0, 0, 0));
  const endDate = now;

  const month = now.getUTCMonth() + 1;
  const year  = now.getUTCFullYear();

  const errors: Record<string, string> = {};

  const [
    geminiResult,
    reveCost,
    railwayResult,
    r2Result,
    resendCost,
    vercelCost,
    renders,
  ] = await Promise.all([
    getGeminiCosts(startDate, endDate).catch(e => { errors.gemini = String(e); return { cost: 0, source: "error" as DataSource }; }),
    getReveCosts(startDate, endDate).catch(e => { errors.reve = String(e); return 0; }),
    getRailwayCosts().catch(e => ({ cost: 0, source: "error" as DataSource, error: String(e) })),
    getR2Costs().catch(e => ({ cost: 0, source: "error" as DataSource, error: String(e) })),
    getResendCosts(startDate, endDate).catch(e => { errors.resend = String(e); return 0; }),
    getVercelCosts(month, year).catch(e => { errors.vercel = String(e); return 0; }),
    getRenderCounts(startDate, endDate).catch(() => ({ regular: 0, staging: 0, total: 0 })),
  ]);

  if (railwayResult.error) errors.railway = railwayResult.error;
  if (r2Result.error)      errors.r2      = r2Result.error;

  const costs = {
    gemini:  geminiResult.cost,
    reve:    reveCost,
    railway: railwayResult.cost,
    r2:      r2Result.cost,
    resend:  resendCost,
    vercel:  vercelCost,
    total:   0,
  };
  costs.total = costs.gemini + costs.reve + costs.railway + costs.r2 + costs.resend + costs.vercel;

  return {
    period,
    costs,
    currency: "USD",
    renders,
    dataSource: {
      gemini:  geminiResult.source,
      reve:    "calculated",
      railway: railwayResult.source,
      r2:      r2Result.source,
      resend:  "calculated",
      vercel:  "manual",
    },
    errors,
    fetchedAt: now.toISOString(),
  };
}
