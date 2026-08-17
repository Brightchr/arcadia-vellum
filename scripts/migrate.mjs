// Applies pending SQL migrations from ./drizzle at boot (used on Railway).
try {
  process.loadEnvFile(); // local dev; on Railway vars are injected
} catch {}

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  // Same advisory lock as src/instrumentation.ts — concurrent boots queue.
  await client.query("SELECT pg_advisory_lock(727501)");
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
} finally {
  await client.query("SELECT pg_advisory_unlock(727501)").catch(() => {});
  client.release();
  await pool.end();
}
console.log("Migrations applied.");
