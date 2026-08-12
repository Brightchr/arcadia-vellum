import { sessionFromRequest, jsonError } from "@/lib/api";
import { channelInGroup, memberRole, setChannelMuted } from "@/lib/groups";

export const runtime = "nodejs";

/** Mute/unmute one channel for the caller. JSON: {muted}. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id, channelId } = await params;
  if (!(await memberRole(id, session.user.id))) {
    return jsonError("Members only", 403);
  }
  if (!(await channelInGroup(id, channelId))) {
    return jsonError("Channel not found", 404);
  }
  const body = (await request.json().catch(() => null)) as {
    muted?: unknown;
  } | null;
  if (typeof body?.muted !== "boolean") {
    return jsonError("muted must be true or false", 400);
  }
  await setChannelMuted(channelId, session.user.id, body.muted);
  return Response.json({ ok: true });
}
