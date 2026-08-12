import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  canModerate,
  deleteChannel,
  memberRole,
  updateChannel,
  type PostMode,
} from "@/lib/groups";

export const runtime = "nodejs";

/** Owner/admin: channel settings — rename, NSFW gate, post restrictions. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id, channelId } = await params;
  if (!canModerate(await memberRole(id, session.user.id))) {
    return jsonError("Only the owner and admins can manage channels", 403);
  }
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    nsfw?: unknown;
    postMode?: unknown;
    postRanks?: unknown;
  } | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  const patch: {
    name?: string;
    nsfw?: boolean;
    postMode?: PostMode;
    postRanks?: string[];
  } = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.nsfw === "boolean") patch.nsfw = body.nsfw;
  if (
    body.postMode === "everyone" ||
    body.postMode === "mods" ||
    body.postMode === "ranks"
  ) {
    patch.postMode = body.postMode;
  }
  if (Array.isArray(body.postRanks)) {
    patch.postRanks = body.postRanks.filter(
      (x): x is string => typeof x === "string"
    );
  }
  const res = await updateChannel(id, channelId, patch);
  if (!res.ok) return jsonError(res.error ?? "Could not update", 400);
  return Response.json({ ok: true });
}

/** Owner/admin: remove a channel (its messages cascade away). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id, channelId } = await params;
  if (!canModerate(await memberRole(id, session.user.id))) {
    return jsonError("Only the owner and admins can manage channels", 403);
  }
  const res = await deleteChannel(id, channelId);
  if (!res.ok) return jsonError(res.error ?? "Could not delete", 400);
  return Response.json({ ok: true });
}
