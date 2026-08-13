import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * S3-compatible object storage for media bytes (Railway Buckets in prod,
 * MinIO in dev). When the env vars are absent everything falls back to the
 * legacy path — media bytes stored in Postgres — so a bucket is optional.
 *
 * Env: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT
 * (blank for AWS), S3_REGION (default "auto"), S3_FORCE_PATH_STYLE
 * ("true" for MinIO and most S3-compatibles).
 */

let cached: { client: S3Client; bucket: string } | null | undefined;

function config() {
  if (cached !== undefined) return cached;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    cached = null;
    return cached;
  }
  cached = {
    bucket,
    client: new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
  return cached;
}

/** True when a bucket is configured — new media goes to object storage. */
export function storageEnabled(): boolean {
  return config() !== null;
}

export async function putObject(
  key: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  const c = config();
  if (!c) throw new Error("Object storage is not configured");
  await c.client.send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );
}

/**
 * Short-lived signed GET URL. Serving routes 302 here so media bytes flow
 * straight from the bucket (with native Range support) instead of through
 * Node and Postgres.
 */
export async function presignGetUrl(
  key: string,
  contentType?: string,
  expiresInSeconds = 3600
): Promise<string> {
  const c = config();
  if (!c) throw new Error("Object storage is not configured");
  return getSignedUrl(
    c.client,
    new GetObjectCommand({
      Bucket: c.bucket,
      Key: key,
      ResponseContentType: contentType,
    }),
    { expiresIn: expiresInSeconds }
  );
}

/** Best-effort delete — orphaned objects cost pennies; requests must not fail. */
export async function deleteObjects(
  keys: (string | null | undefined)[]
): Promise<void> {
  const c = config();
  const real = keys.filter((k): k is string => !!k);
  if (!c || real.length === 0) return;
  try {
    // DeleteObjects caps at 1000 keys; media batches here are far smaller.
    await c.client.send(
      new DeleteObjectsCommand({
        Bucket: c.bucket,
        Delete: { Objects: real.map((Key) => ({ Key })), Quiet: true },
      })
    );
  } catch (err) {
    console.error("[storage] delete failed (continuing):", err);
  }
}
