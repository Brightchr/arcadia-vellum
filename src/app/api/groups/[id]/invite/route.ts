import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  getGroup,
  inviteToGroup,
  isBannedFromGroup,
  memberRole,
} from "@/lib/groups";
import { friendshipBetween } from "@/lib/social";
import { notify } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Invite a friend into the group (any member may invite their friends). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request, "group-invite", {
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;

  const group = await getGroup(id);
  if (!group) return jsonError("Group not found", 404);
  if (!(await memberRole(id, session.user.id))) {
    return jsonError("Only members can invite", 403);
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
  } | null;
  const userId = body?.userId;
  if (!userId || userId === session.user.id) {
    return jsonError("Pick a friend to invite", 400);
  }
  const friendship = await friendshipBetween(session.user.id, userId);
  if (!friendship || friendship.status !== "accepted") {
    return jsonError("You can only invite your friends", 403);
  }
  if (await memberRole(id, userId)) {
    return jsonError("They're already a member", 400);
  }
  if (await isBannedFromGroup(id, userId)) {
    return jsonError("They've been banned from this group", 400);
  }

  await inviteToGroup(id, userId, session.user.id);
  await notify(userId, "group_invite", {
    actorId: session.user.id,
    kind: "group",
    itemId: id,
  });
  return Response.json({ ok: true });
}
