import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Resend } from "resend";
import { prisma } from "../lib/prisma.js";

const BUCKET = () => process.env.R2_BUCKET_NAME!;
const PREFIX = "database-backups/";
const KEEP   = 30;

function r2() {
  return new S3Client({
    region:   "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

// ── Backup ─────────────────────────────────────────────────────────────────────

export async function backupDatabase(): Promise<{
  success: boolean;
  filename: string;
  sizeMB: string;
  rowCount: number;
  backupsRetained: number;
  method: string;
}> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename  = `backup-${timestamp}.json`;

  console.log(`=== BACKUP STARTING: ${filename} ===`);

  try {
    console.log("[backup] Exporting data from database…");

    const [users, projects, renders, products, productClicks, costEntries, revenueEntries] =
      await Promise.all([
        prisma.user.findMany(),
        prisma.project.findMany(),
        prisma.render.findMany(),
        prisma.product.findMany(),
        prisma.productClick.findMany(),
        prisma.costEntry.findMany(),
        prisma.revenueEntry.findMany(),
      ]);

    const rowCount =
      users.length + projects.length + renders.length + products.length +
      productClicks.length + costEntries.length + revenueEntries.length;

    console.log(`[backup] Exported ${rowCount} rows total`);
    console.log(`  Users: ${users.length}, Projects: ${projects.length}, Renders: ${renders.length}`);
    console.log(`  Products: ${products.length}, Clicks: ${productClicks.length}`);
    console.log(`  CostEntries: ${costEntries.length}, RevenueEntries: ${revenueEntries.length}`);

    const backup = {
      metadata: {
        createdAt:   new Date().toISOString(),
        version:     "1.0",
        method:      "prisma-json",
        environment: process.env.NODE_ENV ?? "unknown",
        rowCount,
        tables: {
          users:          users.length,
          projects:       projects.length,
          renders:        renders.length,
          products:       products.length,
          productClicks:  productClicks.length,
          costEntries:    costEntries.length,
          revenueEntries: revenueEntries.length,
        },
      },
      data: { users, projects, renders, products, productClicks, costEntries, revenueEntries },
    };

    const buffer = Buffer.from(JSON.stringify(backup, null, 2), "utf-8");
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

    console.log(`[backup] Size: ${sizeMB} MB — uploading to R2…`);

    await r2().send(new PutObjectCommand({
      Bucket:      BUCKET(),
      Key:         `${PREFIX}${filename}`,
      Body:        buffer,
      ContentType: "application/json",
      Metadata: {
        "created-at": new Date().toISOString(),
        "row-count":  rowCount.toString(),
        "size-mb":    sizeMB,
        "method":     "prisma-json",
        "version":    "1.0",
      },
    }));

    console.log(`[backup] Uploaded: ${PREFIX}${filename}`);

    const backupsRetained = await pruneOldBackups();

    await sendNotification({ success: true, filename, sizeMB, rowCount, backupsRetained });

    console.log(`=== BACKUP COMPLETED: ${filename} ===`);
    return { success: true, filename, sizeMB, rowCount, backupsRetained, method: "prisma-json" };

  } catch (err) {
    console.error("=== BACKUP FAILED ===", err);
    await sendNotification({ success: false, filename, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ── Restore ────────────────────────────────────────────────────────────────────

export async function restoreDatabase(
  backupKey: string,
): Promise<{ success: boolean; rowsRestored: number }> {
  console.log(`=== RESTORE STARTING from: ${backupKey} ===`);

  const res = await r2().send(new GetObjectCommand({ Bucket: BUCKET(), Key: backupKey }));
  const content = await res.Body?.transformToString();
  if (!content) throw new Error("Empty backup file");

  const backup = JSON.parse(content) as {
    metadata: { createdAt: string; rowCount: number };
    data: {
      users: unknown[]; projects: unknown[]; renders: unknown[]; products: unknown[];
      productClicks: unknown[]; costEntries: unknown[]; revenueEntries: unknown[];
    };
  };

  console.log(`[restore] Backup from: ${backup.metadata.createdAt}`);
  console.log(`[restore] Rows to restore: ${backup.metadata.rowCount}`);
  console.log("[restore] Clearing existing data…");

  await prisma.productClick.deleteMany();
  await prisma.render.deleteMany();
  await prisma.project.deleteMany();
  await prisma.costEntry.deleteMany();
  await prisma.revenueEntry.deleteMany();
  await prisma.user.deleteMany();
  await prisma.product.deleteMany();

  console.log("[restore] Restoring data…");

  type D<T extends (...args: never[]) => unknown> = NonNullable<Parameters<T>[0]>["data"];
  await prisma.product.createMany({      data: backup.data.products      as D<typeof prisma.product.createMany>,      skipDuplicates: true });
  await prisma.user.createMany({         data: backup.data.users         as D<typeof prisma.user.createMany>,         skipDuplicates: true });
  await prisma.project.createMany({      data: backup.data.projects      as D<typeof prisma.project.createMany>,      skipDuplicates: true });
  await prisma.render.createMany({       data: backup.data.renders       as D<typeof prisma.render.createMany>,       skipDuplicates: true });
  await prisma.productClick.createMany({ data: backup.data.productClicks as D<typeof prisma.productClick.createMany>, skipDuplicates: true });
  await prisma.costEntry.createMany({    data: backup.data.costEntries   as D<typeof prisma.costEntry.createMany>,    skipDuplicates: true });
  await prisma.revenueEntry.createMany({ data: backup.data.revenueEntries as D<typeof prisma.revenueEntry.createMany>, skipDuplicates: true });

  console.log(`=== RESTORE COMPLETED — ${backup.metadata.rowCount} rows ===`);
  return { success: true, rowsRestored: backup.metadata.rowCount };
}

// ── List ───────────────────────────────────────────────────────────────────────

export type BackupEntry = {
  filename: string; key: string; sizeMB: string;
  createdAt: string; formattedDate: string; method: string;
};

export async function listBackups(): Promise<BackupEntry[]> {
  const res = await r2().send(new ListObjectsV2Command({ Bucket: BUCKET(), Prefix: PREFIX }));

  return (res.Contents ?? [])
    .filter(o => o.Key?.endsWith(".json"))
    .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
    .map(o => ({
      filename:      (o.Key ?? "").replace(PREFIX, ""),
      key:           o.Key ?? "",
      sizeMB:        ((o.Size ?? 0) / (1024 * 1024)).toFixed(2),
      createdAt:     o.LastModified?.toISOString() ?? "",
      formattedDate: o.LastModified?.toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }) ?? "",
      method: "prisma-json",
    }));
}

// ── Stats ──────────────────────────────────────────────────────────────────────

export async function getBackupStats() {
  const backups = await listBackups();
  const totalSizeMB = backups.reduce((s, b) => s + parseFloat(b.sizeMB), 0).toFixed(2);
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(2, 0, 0, 0);
  return {
    totalBackups:    backups.length,
    latestBackup:    backups[0] ?? null,
    oldestBackup:    backups[backups.length - 1] ?? null,
    totalSizeMB,
    nextScheduled:   next.toISOString(),
    method:          "prisma-json",
    storageLocation: `Cloudflare R2 (${PREFIX})`,
  };
}

// ── Prune ──────────────────────────────────────────────────────────────────────

async function pruneOldBackups(): Promise<number> {
  const client = r2();
  const res = await client.send(new ListObjectsV2Command({ Bucket: BUCKET(), Prefix: PREFIX }));

  const all = (res.Contents ?? [])
    .filter(o => o.Key?.endsWith(".json"))
    .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0));

  for (const obj of all.slice(KEEP)) {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: obj.Key! }));
    console.log(`[backup] Pruned: ${obj.Key}`);
  }
  return Math.min(all.length, KEEP);
}

// ── Notifications ──────────────────────────────────────────────────────────────

async function sendNotification(p: {
  success: boolean; filename: string;
  sizeMB?: string; rowCount?: number; backupsRetained?: number; error?: string;
}) {
  const apiKey     = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  const from       = process.env.EMAIL_FROM ?? "hello@myinteriordesigner.co.uk";
  if (!apiKey || !adminEmail) return;

  try {
    const resend = new Resend(apiKey);
    if (p.success) {
      if (new Date().getDay() !== 0) { // weekly summaries only on Sundays
        console.log("[backup] Success — weekly email skipped (not Sunday)");
        return;
      }
      await resend.emails.send({
        from, to: adminEmail,
        subject: "✅ Weekly Backup Report — MyInteriorDesigner",
        html: `<h2>Weekly Backup Report</h2>
<p>All daily backups completed successfully this week.</p>
<table cellpadding="6"><tr><td><b>Latest</b></td><td>${p.filename}</td></tr>
<tr><td><b>Size</b></td><td>${p.sizeMB} MB</td></tr>
<tr><td><b>Rows</b></td><td>${p.rowCount?.toLocaleString()}</td></tr>
<tr><td><b>Retained</b></td><td>${p.backupsRetained} (last ${KEEP})</td></tr>
<tr><td><b>Method</b></td><td>Prisma JSON</td></tr>
<tr><td><b>Location</b></td><td>Cloudflare R2 / ${PREFIX}</td></tr></table>`,
      });
    } else {
      await resend.emails.send({
        from, to: adminEmail,
        subject: "🚨 DATABASE BACKUP FAILED — Action Required!",
        html: `<h2 style="color:red">Database Backup Failed</h2>
<p>Failed at ${new Date().toISOString()}</p>
<p><b>File:</b> ${p.filename}</p>
<p><b>Error:</b> ${p.error ?? "Unknown"}</p>
<h3>Action required:</h3>
<ol><li>Open admin dashboard → System</li><li>Click "Run Backup Now"</li><li>If it fails again, check Railway logs</li></ol>`,
      });
    }
  } catch (e) {
    console.error("[backup] Email notification failed:", e);
  }
}
