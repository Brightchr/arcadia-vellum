// Applies pending SQL migrations from ./drizzle at boot (used on Railway).
try {
  process.loadEnvFile(); // local dev; on Railway vars are injected
} catch {}

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
await pool.end();
console.log("Migrations applied.");
