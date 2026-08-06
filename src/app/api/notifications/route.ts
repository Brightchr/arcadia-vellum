import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  listNotifications,
  unreadCount,
  markAllRead,
} from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const [items, unread] = await Promise.all([
    listNotifications(session.user.id),
    unreadCount(session.user.id),
  ]);
  return Response.json({ items, unread });
}

/** Mark everything read. */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  await markAllRead(session.user.id);
  return Response.json({ ok: true });
}
