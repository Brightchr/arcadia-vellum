/**
 * One-time backfill: moves media bytes out of Postgres into the configured
 * S3-compatible bucket, then nulls the bytea column. Safe to re-run — rows
 * that already have a storage_key are skipped, so an interrupted run just
 * picks up where it left off.
 *
 * Usage (needs DATABASE_URL + S3_* env vars):
 *   node scripts/migrate-media-to-bucket.mjs           # migrate everything
 *   node scripts/migrate-media-to-bucket.mjs --dry-run # count only
 *
 * On Railway: `railway run node scripts/migrate-media-to-bucket.mjs`.
 * Postgres won't shrink on its own afterwards — run `VACUUM FULL
 * journal_audio, journal_images, profile_images;` in a quiet moment (it
 * locks each table while it rewrites it).
 */

import pg from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const { DATABASE_URL, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } =
  process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
  throw new Error("S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY are required");
}
const dryRun = process.argv.includes("--dry-run");

const s3 = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
});

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

/** table config: [table, ownerColumn, keyPrefix] */
const TABLES = [
  ["journal_audio", "journal_id", "audio"],
  ["journal_images", "journal_id", "journal-images"],
  ["profile_images", "user_id", "profile-images"],
];

let totalMoved = 0;
let totalBytes = 0;

for (const [table, ownerCol, prefix] of TABLES) {
  const { rows: countRows } = await client.query(
    `SELECT count(*)::int AS n, coalesce(sum(octet_length(data)), 0)::bigint AS bytes
     FROM ${table} WHERE data IS NOT NULL AND storage_key IS NULL`
  );
  const pending = countRows[0];
  console.log(`${table}: ${pending.n} rows to move (${(Number(pending.bytes) / 1024 / 1024).toFixed(1)} MB)`);
  if (dryRun || pending.n === 0) continue;

  // One row at a time — audio rows can be 100 MB; keep memory flat.
  for (;;) {
    const { rows } = await client.query(
      `SELECT id, ${ownerCol} AS owner, content_type, data
       FROM ${table} WHERE data IS NOT NULL AND storage_key IS NULL
       ORDER BY created_at LIMIT 1`
    );
    const row = rows[0];
    if (!row) break;

    const key = `${prefix}/${row.owner}/${row.id}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: row.data,
        ContentType: row.content_type,
      })
    );
    await client.query(
      `UPDATE ${table} SET storage_key = $1, data = NULL WHERE id = $2`,
      [key, row.id]
    );
    totalMoved++;
    totalBytes += row.data.length;
    if (totalMoved % 25 === 0) {
      console.log(`  ...${totalMoved} objects, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
    }
  }
}

console.log(
  dryRun
    ? "Dry run complete — nothing changed."
    : `Done: ${totalMoved} objects (${(totalBytes / 1024 / 1024).toFixed(1)} MB) moved to ${S3_BUCKET}.`
);
await client.end();
