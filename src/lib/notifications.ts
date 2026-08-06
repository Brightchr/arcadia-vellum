import { db } from "@/db";
import { notifications, user, journals, series } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { newId } from "@/lib/id";

export type NotificationType =
  | "friend_request"
  | "friend_accept"
  | "new_follower"
  | "review"
  | "new_volume"
  | "new_work"
  | "access_request"
  | "access_granted"
  | "user_banned";

export async function notify(
  userId: string,
  type: NotificationType,
  opts: { actorId?: string; kind?: "journal" | "series"; itemId?: string } = {}
) {
  if (opts.actorId === userId) return; // never notify yourself
  await db.insert(notifications).values({
    id: newId(),
    userId,
    type,
    actorId: opts.actorId ?? null,
    kind: opts.kind ?? null,
    itemId: opts.itemId ?? null,
  });
}

export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  opts: { actorId?: string; kind?: "journal" | "series"; itemId?: string } = {}
) {
  for (const id of new Set(userIds)) {
    await notify(id, type, opts);
  }
}

export interface NotificationView {
  id: string;
  type: string;
  read: boolean;
  createdAt: Date;
  actorName: string | null;
  actorUsername: string | null;
  actorAvatarId: string | null;
  itemTitle: string | null;
  itemHref: string | null;
}

/** Latest notifications with actor + work context resolved for display. */
export async function listNotifications(
  userId: string,
  limit = 15
): Promise<NotificationView[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      read: notifications.read,
      createdAt: notifications.createdAt,
      kind: notifications.kind,
      itemId: notifications.itemId,
      actorName: user.name,
      actorUsername: user.username,
      actorAvatarId: user.avatarImageId,
    })
    .from(notifications)
    .leftJoin(user, eq(notifications.actorId, user.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  const out: NotificationView[] = [];
  for (const r of rows) {
    let itemTitle: string | null = null;
    let itemHref: string | null = null;
    if (r.kind === "journal" && r.itemId) {
      const j = await db
        .select({ title: journals.title, slug: journals.slug })
        .from(journals)
        .where(eq(journals.id, r.itemId));
      if (j[0]) {
        itemTitle = j[0].title;
        itemHref = `/book/${j[0].slug}`;
      }
    } else if (r.kind === "series" && r.itemId) {
      const s = await db
        .select({ name: series.name, slug: series.slug })
        .from(series)
        .where(eq(series.id, r.itemId));
      if (s[0]) {
        itemTitle = s[0].name;
        itemHref = `/series/${s[0].slug}`;
      }
    }
    out.push({
      id: r.id,
      type: r.type,
      read: r.read,
      createdAt: r.createdAt,
      actorName: r.actorName,
      actorUsername: r.actorUsername,
      actorAvatarId: r.actorAvatarId,
      itemTitle,
      itemHref,
    });
  }
  return out;
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return row?.n ?? 0;
}

export async function markAllRead(userId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}
