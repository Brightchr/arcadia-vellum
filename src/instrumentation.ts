/**
 * Runs once when the server boots (Next.js instrumentation hook).
 * Applies pending database migrations so deploys are self-contained —
 * no custom start command required.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return;

  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { Pool } = await import("pg");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
    console.log("[migrate] database is up to date");
  } catch (error) {
    console.error("[migrate] failed to apply migrations:", error);
  } finally {
    await pool.end();
  }
}
