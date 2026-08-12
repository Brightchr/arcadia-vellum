import { sessionFromRequest, jsonError } from "@/lib/api";
import { friendsWithPresence } from "@/lib/presence";
import {
  listGroupsForUser,
  mutedGroupIds,
  unreadGroupIds,
} from "@/lib/groups";
import {
  listNotifications,
  markAllRead,
  unreadCount,
} from "@/lib/notifications";

export const runtime = "nodejs";

/** Everything the social rail shows: friends, groups, social alerts. */
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const [friends, groups, alerts, unread] = await Promise.all([
    friendsWithPresence(session.user.id),
    listGroupsForUser(session.user.id),
    listNotifications(session.user.id, 20, "social"),
    unreadCount(session.user.id, "social"),
  ]);
  const [unreadGroups, mutedGroups] = await Promise.all([
    unreadGroupIds(
      session.user.id,
      groups.map((g) => g.id)
    ),
    mutedGroupIds(session.user.id),
  ]);
  return Response.json(
    {
      friends,
      groups: groups.map((g) => ({
        ...g,
        unread: unreadGroups.has(g.id),
        muted: mutedGroups.has(g.id),
      })),
      alerts,
      unread,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Mark the social alerts read (rail Alerts tab opened). */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  await markAllRead(session.user.id, "social");
  return Response.json({ ok: true });
}
