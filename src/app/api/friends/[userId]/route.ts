import { sessionFromRequest, jsonError } from "@/lib/api";
import { getUserById } from "@/lib/profile";
import {
  requestFriendship,
  acceptFriendship,
  removeFriendship,
} from "@/lib/social";
import { notify } from "@/lib/notifications";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Send a friend request. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Each request writes a row + notification + device push — throttle both
  // the network and the account.
  const limited = rateLimit(request, "friend-request", {
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const userLimited = rateLimitUser(session.user.id, "friend-request", {
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (userLimited) return userLimited;
  const { userId } = await params;
  if (userId === session.user.id) return jsonError("That's you", 400);
  const target = await getUserById(userId);
  if (!target) return jsonError("User not found", 404);
  if (!target.allowFriendRequests) {
    return jsonError("This user isn't accepting friend requests", 403);
  }
  await requestFriendship(session.user.id, userId);
  await notify(userId, "friend_request", { actorId: session.user.id });
  return Response.json({ ok: true });
}

/** Accept a pending request from userId. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { userId } = await params;
  const ok = await acceptFriendship(session.user.id, userId);
  if (!ok) return jsonError("No pending request from this user", 400);
  await notify(userId, "friend_accept", { actorId: session.user.id });
  return Response.json({ ok: true });
}

/** Decline a request or end a friendship. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { userId } = await params;
  await removeFriendship(session.user.id, userId);
  return Response.json({ ok: true });
}
