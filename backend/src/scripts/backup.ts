import { exec } from "child_process";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { promisify } from "util";
import * as fs from "fs";
import { Resend } from "resend";

const execAsync = promisify(exec);

function r2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET   = () => process.env.R2_BUCKET_NAME!;
const PREFIX   = "database-backups/";
const KEEP     = 5;

function maskError(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// ── Core backup ────────────────────────────────────────────────────────────────

export async function backupDatabase(): Promise<{
  success: boolean;
  filename: string;
  sizeMB: number;
  backupsRetained: number;
}> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `backup-${timestamp}.sql`;
  const filepath = `/tmp/${filename}`;

  console.log(`[backup] Starting: ${filename}`);

  try {
    await execAsync(`pg_dump "${process.env.DATABASE_URL}" > ${filepath}`);
    console.log("[backup] pg_dump complete");

    const fileContent = fs.readFileSync(filepath);
    const sizeMB = fileContent.length / (1024 * 1024);

    await r2Client().send(new PutObjectCommand({
      Bucket:      BUCKET(),
      Key:         `${PREFIX}${filename}`,
      Body:        fileContent,
      ContentType: "application/sql",
      Metadata: {
        "created-at":  new Date().toISOString(),
        "size-mb":     sizeMB.toFixed(2),
        "environment": "production",
      },
    }));
    console.log(`[backup] Uploaded to R2: ${PREFIX}${filename}`);

    fs.unlinkSync(filepath);

    const backupsRetained = await pruneOldBackups();

    await sendNotification(true, filename, sizeMB, backupsRetained);

    console.log("[backup] Done");
    return { success: true, filename, sizeMB, backupsRetained };
  } catch (error) {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    await sendNotification(false, filename, 0, 0, error);
    console.error("[backup] Failed:", error);
    throw error;
  }
}

async function pruneOldBackups(): Promise<number> {
  const client = r2Client();
  const res = await client.send(new ListObjectsV2Command({
    Bucket: BUCKET(),
    Prefix: PREFIX,
  }));

  const all = (res.Contents ?? [])
    .filter(o => o.Key?.endsWith(".sql"))
    .sort((a, b) =>
      (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
    );

  const toDelete = all.slice(KEEP);
  for (const obj of toDelete) {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: obj.Key! }));
    console.log(`[backup] Pruned: ${obj.Key}`);
  }

  return Math.min(all.length, KEEP);
}

async function sendNotification(
  success: boolean,
  filename: string,
  sizeMB: number,
  backupsRetained: number,
  error?: unknown,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!apiKey || !adminEmail) return;

  try {
    const resend = new Resend(apiKey);

    if (success) {
      // Weekly summary only (Sundays) — avoid daily inbox noise
      if (new Date().getDay() !== 0) return;
      await resend.emails.send({
        from:    "alerts@myinteriordesigner.co.uk",
        to:      adminEmail,
        subject: "✅ Weekly Backup Report — MyInteriorDesigner",
        html: `<h2>Weekly Backup Report</h2>
<p>All daily backups completed successfully this week.</p>
<table cellpadding="6">
  <tr><td><b>Latest file</b></td><td>${filename}</td></tr>
  <tr><td><b>Size</b></td><td>${sizeMB.toFixed(2)} MB</td></tr>
  <tr><td><b>Backups retained</b></td><td>${backupsRetained} (last ${KEEP})</td></tr>
  <tr><td><b>Location</b></td><td>Cloudflare R2 / ${PREFIX}</td></tr>
</table>`,
      });
    } else {
      await resend.emails.send({
        from:    "alerts@myinteriordesigner.co.uk",
        to:      adminEmail,
        subject: "🚨 DATABASE BACKUP FAILED — Action Required!",
        html: `<h2 style="color:red">Database Backup Failed</h2>
<p>Scheduled backup failed at ${new Date().toISOString()}</p>
<p><b>File attempted:</b> ${filename}</p>
<p><b>Error:</b> ${maskError(error)}</p>
<hr/>
<h3>Action required</h3>
<ol>
  <li>Open the admin dashboard → System tab</li>
  <li>Click "Run Backup Now"</li>
  <li>If that also fails, check Railway logs</li>
</ol>`,
      });
    }
  } catch (emailErr) {
    console.error("[backup] Email notification failed:", emailErr);
  }
}

// ── List backups ───────────────────────────────────────────────────────────────

export type BackupEntry = {
  filename: string;
  key: string;
  sizeMB: string;
  createdAt: string;
  formattedDate: string;
};

export async function listBackups(): Promise<BackupEntry[]> {
  const res = await r2Client().send(new ListObjectsV2Command({
    Bucket: BUCKET(),
    Prefix: PREFIX,
  }));

  return (res.Contents ?? [])
    .filter(o => o.Key?.endsWith(".sql"))
    .sort((a, b) =>
      (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
    )
    .map(o => ({
      filename:      (o.Key ?? "").replace(PREFIX, ""),
      key:           o.Key ?? "",
      sizeMB:        ((o.Size ?? 0) / (1024 * 1024)).toFixed(2),
      createdAt:     o.LastModified?.toISOString() ?? "",
      formattedDate: o.LastModified?.toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }) ?? "",
    }));
}
