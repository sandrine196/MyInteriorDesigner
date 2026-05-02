import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
}

// ── Cloudflare R2 ──────────────────────────────────────────────────────────────
// Install: npm install @aws-sdk/client-s3
// Required env: R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, STORAGE_PUBLIC_URL

class R2StorageService implements StorageService {
  async upload(_key: string, _data: Buffer, _contentType?: string): Promise<void> {
    // TODO: import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
    // const client = new S3Client({ endpoint: config.storage.endpoint, region: "auto", credentials: { ... } })
    // await client.send(new PutObjectCommand({ Bucket: config.storage.bucket, Key: _key, Body: _data, ContentType: _contentType }))
    throw new Error(
      "R2 storage not yet wired up. Set STORAGE_PROVIDER=local or configure R2 credentials and uncomment the S3Client code."
    );
  }

  async delete(_key: string): Promise<void> {
    // TODO: new S3Client(...).send(new DeleteObjectCommand({ Bucket, Key }))
    throw new Error("R2 storage not yet wired up.");
  }

  getUrl(key: string): string {
    return `${config.storage.publicUrl ?? ""}/${key}`;
  }
}

// ── AWS S3 ─────────────────────────────────────────────────────────────────────
// Install: npm install @aws-sdk/client-s3
// Required env: S3_ENDPOINT (optional), S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, STORAGE_PUBLIC_URL

class S3StorageService implements StorageService {
  async upload(_key: string, _data: Buffer, _contentType?: string): Promise<void> {
    // Same S3Client pattern as R2 but without the custom endpoint
    throw new Error("S3 storage not yet wired up. Configure S3 credentials.");
  }

  async delete(_key: string): Promise<void> {
    throw new Error("S3 storage not yet wired up.");
  }

  getUrl(key: string): string {
    return `${config.storage.publicUrl ?? ""}/${key}`;
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
