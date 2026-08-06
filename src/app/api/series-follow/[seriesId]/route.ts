import { db } from "@/db";
import { series } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { followSeries, unfollowSeries } from "@/lib/social";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { seriesId } = await params;
  const rows = await db.select().from(series).where(eq(series.id, seriesId));
  if (!rows[0]) return jsonError("Series not found", 404);
  await followSeries(session.user.id, seriesId);
  return Response.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { seriesId } = await params;
  await unfollowSeries(session.user.id, seriesId);
  return Response.json({ ok: true });
}
