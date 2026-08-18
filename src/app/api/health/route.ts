import { db } from "@/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

const bootedAt = Date.now();

/**
 * Liveness + database reachability. Point Railway's healthcheck here, or
 * poll it from any uptime monitor — it answers 200 with DB latency when
 * healthy and 503 when the database is unreachable.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      {
        ok: true,
        dbMs: Date.now() - started,
        uptimeSec: Math.round((Date.now() - bootedAt) / 1000),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { ok: false, error: "database unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
