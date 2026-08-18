import { db } from "@/db";
import { notifications, user, journals, series, groups } from "@/db/schema";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { newId } from "@/lib/id";
import { pushForNotification } from "@/lib/push";

export type NotificationType =
  | "friend_request"
  | "friend_accept"
  | "new_follower"
  | "review"
  | "new_volume"
  | "new_work"
  | "access_request"
  | "access_granted"
  | "group_invite"
  | "mention"
  | "report_opened"
  | "report_dismissed"
  | "report_upheld"
  | "user_banned";

/**
 * Social notifications live in the social rail (friends & groups); everything
 * else — reviews, releases, access, moderation — stays in the system bell.
 */
export const SOCIAL_TYPES: NotificationType[] = [
  "friend_request",
  "friend_accept",
  "new_follower",
  "group_invite",
  "mention",
];

export type NotificationScope = "social" | "system";

function scopeCondition(userId: string, scope?: NotificationScope) {
  if (scope === "social") {
    return and(
      eq(notifications.userId, userId),
      inArray(notifications.type, SOCIAL_TYPES)
    );
  }
  if (scope === "system") {
    return and(
      eq(notifications.userId, userId),
      notInArray(notifications.type, SOCIAL_TYPES)
    );
  }
  return eq(notifications.userId, userId);
}

export async function notify(
  userId: string,
  type: NotificationType,
  opts: {
    actorId?: string;
    kind?: "journal" | "series" | "group";
    itemId?: string;
  } = {}
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
  // Device push (mentions, invites, friend events) — never blocks the caller.
  void pushForNotification(userId, type, opts);
}

export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  opts: {
    actorId?: string;
    kind?: "journal" | "series" | "group";
    itemId?: string;
  } = {}
) {
  const targets = [...new Set(userIds)].filter((id) => id !== opts.actorId);
  if (targets.length === 0) return;
  // One insert for the whole fanout — publish/ban events can have hundreds
  // of recipients, and a row-per-await loop held the request open for all
  // of them.
  await db.insert(notifications).values(
    targets.map((userId) => ({
      id: newId(),
      userId,
      type,
      actorId: opts.actorId ?? null,
      kind: opts.kind ?? null,
      itemId: opts.itemId ?? null,
    }))
  );
  for (const userId of targets) {
    void pushForNotification(userId, type, opts);
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
  limit = 15,
  scope?: NotificationScope
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
    .where(scopeCondition(userId, scope))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  // Resolve referenced works/groups in one query per kind — this runs on
  // the 60s social poll, so a per-row lookup here was the app's worst N+1.
  const journalIds = new Set<string>();
  const seriesIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const r of rows) {
    if (!r.itemId) continue;
    if (r.kind === "journal") journalIds.add(r.itemId);
    else if (r.kind === "series") seriesIds.add(r.itemId);
    else if (r.kind === "group") groupIds.add(r.itemId);
  }
  const [journalRefs, seriesRefs, groupRefs] = await Promise.all([
    journalIds.size > 0
      ? db
          .select({ id: journals.id, title: journals.title, slug: journals.slug })
          .from(journals)
          .where(inArray(journals.id, [...journalIds]))
      : Promise.resolve([]),
    seriesIds.size > 0
      ? db
          .select({ id: series.id, name: series.name, slug: series.slug })
          .from(series)
          .where(inArray(series.id, [...seriesIds]))
      : Promise.resolve([]),
    groupIds.size > 0
      ? db
          .select({ id: groups.id, name: groups.name })
          .from(groups)
          .where(inArray(groups.id, [...groupIds]))
      : Promise.resolve([]),
  ]);
  const jRef = new Map(journalRefs.map((j) => [j.id, j]));
  const sRef = new Map(seriesRefs.map((s) => [s.id, s]));
  const gRef = new Map(groupRefs.map((g) => [g.id, g]));

  return rows.map((r) => {
    let itemTitle: string | null = null;
    let itemHref: string | null = null;
    if (r.kind === "journal" && r.itemId) {
      const j = jRef.get(r.itemId);
      if (j) {
        itemTitle = j.title;
        itemHref = `/book/${j.slug}`;
      }
    } else if (r.kind === "series" && r.itemId) {
      const s = sRef.get(r.itemId);
      if (s) {
        itemTitle = s.name;
        itemHref = `/series/${s.slug}`;
      }
    } else if (r.kind === "group" && r.itemId) {
      const g = gRef.get(r.itemId);
      if (g) {
        itemTitle = g.name;
        itemHref = `/groups/${r.itemId}`;
      }
    }
    return {
      id: r.id,
      type: r.type,
      read: r.read,
      createdAt: r.createdAt,
      actorName: r.actorName,
      actorUsername: r.actorUsername,
      actorAvatarId: r.actorAvatarId,
      itemTitle,
      itemHref,
    };
  });
}

export async function unreadCount(
  userId: string,
  scope?: NotificationScope
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(scopeCondition(userId, scope), eq(notifications.read, false)));
  return row?.n ?? 0;
}

export async function markAllRead(userId: string, scope?: NotificationScope) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(scopeCondition(userId, scope), eq(notifications.read, false)));
}
