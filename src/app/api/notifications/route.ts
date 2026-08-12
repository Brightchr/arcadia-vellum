import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  listNotifications,
  unreadCount,
  markAllRead,
} from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * The bell shows SYSTEM notifications (reviews, releases, access,
 * moderation); social ones (friends, groups) live in the social rail via
 * /api/social. ?scope=all returns everything.
 */
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const scope =
    new URL(request.url).searchParams.get("scope") === "all"
      ? undefined
      : ("system" as const);
  const [items, unread] = await Promise.all([
    listNotifications(session.user.id, 15, scope),
    unreadCount(session.user.id, scope),
  ]);
  return Response.json({ items, unread });
}

/** Mark the system notifications read. */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  await markAllRead(session.user.id, "system");
  return Response.json({ ok: true });
}
