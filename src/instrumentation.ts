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
    // Advisory lock so concurrently-booting replicas take turns instead of
    // racing on the migrations table. Session-scoped: released on unlock or
    // if this connection dies.
    const client = await pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock(727501)");
      await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
      console.log("[migrate] database is up to date");
    } finally {
      await client.query("SELECT pg_advisory_unlock(727501)").catch(() => {});
      client.release();
    }
  } catch (error) {
    // A failed migration means the schema and the code disagree — crash the
    // boot loudly instead of serving against the wrong schema.
    console.error("[migrate] failed to apply migrations:", error);
    throw error;
  } finally {
    await pool.end();
  }
}
