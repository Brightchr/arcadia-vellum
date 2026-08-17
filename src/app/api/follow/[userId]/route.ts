import { sessionFromRequest, jsonError } from "@/lib/api";
import { getUserById } from "@/lib/profile";
import { followUser, unfollowUser } from "@/lib/social";
import { notify } from "@/lib/notifications";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Each follow writes a row + a new_follower notification — throttle both
  // the network and the account.
  const limited = rateLimit(request, "follow", {
    limit: 30,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const userLimited = rateLimitUser(session.user.id, "follow", {
    limit: 60,
    windowMs: 60 * 60_000,
  });
  if (userLimited) return userLimited;
  const { userId } = await params;
  if (userId === session.user.id) return jsonError("That's you", 400);
  if (!(await getUserById(userId))) return jsonError("User not found", 404);
  await followUser(session.user.id, userId);
  await notify(userId, "new_follower", { actorId: session.user.id });
  return Response.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { userId } = await params;
  await unfollowUser(session.user.id, userId);
  return Response.json({ ok: true });
}
