import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config/index.js";

const UPLOADS_ROOT = join(process.cwd(), "uploads");

// ── Interface ──────────────────────────────────────────────────────────────────
// All file operations go through this abstraction.
// Swap storage providers with a single STORAGE_PROVIDER env var — no code changes.

export interface StorageService {
  /** Write a file. `key` is a path like "renders/abc123.png". */
  upload(key: string, data: Buffer, contentType?: string): Promise<void>;
  /** Remove a file. Silently ignores missing files. */
  delete(key: string): Promise<void>;
  /** Return the public URL for a stored key. */
  getUrl(key: string): string;
  /** Read a stored file and return its raw bytes. */
  download(key: string): Promise<Buffer>;
}

// ── Local filesystem (current) ─────────────────────────────────────────────────

class LocalStorageService implements StorageService {
  async upload(key: string, data: Buffer): Promise<void> {
    const fullPath = join(UPLOADS_ROOT, key);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }

  async delete(key: string): Promise<void> {
    await unlink(join(UPLOADS_ROOT, key));
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    return readFile(join(UPLOADS_ROOT, key));
  }
}

// ── Cloudflare R2 ──────────────────────────────────────────────────────────────
// Required env: R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID
// Optional: STORAGE_PUBLIC_URL overrides the default pub-{accountId}.r2.dev base URL

class R2StorageService implements StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = config.storage.bucket!;
    this.client = new S3Client({
      region: "auto",
      endpoint: config.storage.endpoint,
      credentials: {
        accessKeyId: config.storage.accessKeyId!,
        secretAccessKey: config.storage.secretAccessKey!,
      },
    });
  }

  async upload(key: string, data: Buffer, contentType?: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  getUrl(key: string): string {
    const base = config.storage.publicUrl
      ?? `https://pub-${config.storage.accountId}.r2.dev`;
    return `${base}/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

// ── AWS S3 ─────────────────────────────────────────────────────────────────────
// Install: npm install @aws-sdk/client-s3
// Required env: S3_ENDPOINT (optional), S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, STORAGE_PUBLIC_URL

class S3StorageService implements StorageService {
  async upload(_key: string, _data: Buffer, _contentType?: string): Promise<void> {
    throw new Error("S3 storage not yet wired up. Configure S3 credentials.");
  }

  async delete(_key: string): Promise<void> {
    throw new Error("S3 storage not yet wired up.");
  }

  getUrl(key: string): string {
    return `${config.storage.publicUrl ?? ""}/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const res = await fetch(this.getUrl(key));
    if (!res.ok) throw new Error(`S3 download failed for key "${key}": ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

// ── Scaleway Object Storage ────────────────────────────────────────────────────
// EU-based alternative — useful if EU data residency is required.
// Install: npm install @aws-sdk/client-s3 (Scaleway uses S3-compatible API)
// Required env: STORAGE_REGION (e.g. fr-par), R2_ENDPOINT=https://s3.fr-par.scw.cloud, STORAGE_PUBLIC_URL

class ScalewayStorageService implements StorageService {
  async upload(_key: string, _data: Buffer, _contentType?: string): Promise<void> {
    throw new Error(
      "Scaleway storage not yet wired up. Configure S3-compatible credentials with Scaleway endpoint."
    );
  }

  async delete(_key: string): Promise<void> {
    throw new Error("Scaleway storage not yet wired up.");
  }

  getUrl(key: string): string {
    return `${config.storage.publicUrl ?? ""}/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const res = await fetch(this.getUrl(key));
    if (!res.ok) throw new Error(`Scaleway download failed for key "${key}": ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

// ── Factory + singleton ────────────────────────────────────────────────────────

function createStorageService(): StorageService {
  switch (config.storage.provider) {
    case "r2":
      return new R2StorageService();
    case "s3":
      return new S3StorageService();
    case "scaleway":
      return new ScalewayStorageService();
    default:
      return new LocalStorageService();
  }
}

export const storage: StorageService = createStorageService();
