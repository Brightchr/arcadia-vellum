import { sessionFromRequest, jsonError } from "@/lib/api";
import { channelInGroup, markChannelRead, memberRole } from "@/lib/groups";

export const runtime = "nodejs";

/** Explicit "mark as read" (the channel menu) — clears the unread dot. */
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
  await markChannelRead(session.user.id, channelId);
  return Response.json({ ok: true });
}
