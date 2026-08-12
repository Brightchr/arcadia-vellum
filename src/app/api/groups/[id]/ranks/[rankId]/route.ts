import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  canModerate,
  deleteRank,
  memberRole,
  updateRank,
} from "@/lib/groups";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";

export const runtime = "nodejs";

async function guard(
  request: Request,
  params: Promise<{ id: string; rankId: string }>
) {
  const session = await sessionFromRequest(request);
  if (!session) return { error: jsonError("Not signed in", 401) };
  const { id, rankId } = await params;
  if (!canModerate(await memberRole(id, session.user.id))) {
    return { error: jsonError("Only the owner and admins can manage ranks", 403) };
  }
  return { id, rankId };
}

/** Rename / recolor a rank. JSON: {name?, color?}. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rankId: string }> }
) {
  const g = await guard(request, params);
  if ("error" in g) return g.error;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    color?: unknown;
  } | null;
  const patch: { name?: string; color?: string } = {};
  if (typeof body?.name === "string") {
    if (!isTextSafe(body.name)) return jsonError(UNSAFE_TEXT_ERROR, 400);
    patch.name = body.name;
  }
  if (typeof body?.color === "string") patch.color = body.color;
  const res = await updateRank(g.id, g.rankId, patch);
  if (!res.ok) return jsonError(res.error ?? "Could not update", 400);
  return Response.json({ ok: true });
}

/** Delete a rank (holders lose it; channel restrictions drop it). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; rankId: string }> }
) {
  const g = await guard(request, params);
  if ("error" in g) return g.error;
  await deleteRank(g.id, g.rankId);
  return Response.json({ ok: true });
}
