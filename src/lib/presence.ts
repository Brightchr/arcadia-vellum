import { db } from "@/db";
import { journals, readingActivity, series, user } from "@/db/schema";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { listFriends, type RelatedUser } from "@/lib/social";

/** A heartbeat within this window counts as "online" (beacon fires every 60s). */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** A work opened within this window shows as "Reading …" while online. */
const ACTIVITY_WINDOW_MS = 90 * 60 * 1000;

export function isOnline(lastSeenAt: Date | null | undefined): boolean {
  return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}

/** Refresh the signed-in user's heartbeat. */
export async function touchPresence(userId: string) {
  await db
    .update(user)
    .set({ lastSeenAt: new Date() })
    .where(eq(user.id, userId));
}

export interface FriendPresence extends RelatedUser {
  online: boolean;
  /** "Reading <title>" / "Listening to <title>" — null when idle or hidden. */
  activityLabel: string | null;
  /** Store page of the work being read, when shareable. */
  activityHref: string | null;
}

/**
 * The most recent public work each user opened within the activity window.
 * Only public works are ever shown — private/friends-only reading stays
 * invisible no matter the reader's settings.
 */
async function currentActivity(
  userIds: string[]
): Promise<Map<string, { label: string; href: string }>> {
  const map = new Map<string, { label: string; href: string }>();
  if (userIds.length === 0) return map;
  const cutoff = new Date(Date.now() - ACTIVITY_WINDOW_MS);
  // Filter in SQL — reading history grows forever (it feeds recommendations),
  // but only the activity window matters here.
  const rows = await db
    .select()
    .from(readingActivity)
    .where(
      and(
        inArray(readingActivity.userId, userIds),
        gt(readingActivity.updatedAt, cutoff)
      )
    )
    .orderBy(desc(readingActivity.updatedAt));

  const journalIds = new Set<string>();
  const seriesIds = new Set<string>();
  const firstRow = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (firstRow.has(r.userId)) continue;
    firstRow.set(r.userId, r);
    if (r.kind === "journal") journalIds.add(r.itemId);
    else seriesIds.add(r.itemId);
  }
  if (firstRow.size === 0) return map;

  const [journalRows, seriesRows] = await Promise.all([
    journalIds.size > 0
      ? db
          .select({
            id: journals.id,
            title: journals.title,
            slug: journals.slug,
            visibility: journals.visibility,
          })
          .from(journals)
          .where(inArray(journals.id, [...journalIds]))
      : Promise.resolve([]),
    seriesIds.size > 0
      ? db
          .select({ id: series.id, name: series.name, slug: series.slug })
          .from(series)
          .where(inArray(series.id, [...seriesIds]))
      : Promise.resolve([]),
  ]);
  const journalMap = new Map(journalRows.map((j) => [j.id, j]));
  const seriesMap = new Map(seriesRows.map((s) => [s.id, s]));

  for (const [userId, r] of firstRow) {
    const verb = r.mode === "listen" ? "Listening to" : "Reading";
    if (r.kind === "journal") {
      const j = journalMap.get(r.itemId);
      if (!j || j.visibility !== "public") continue;
      map.set(userId, {
        label: `${verb} ${j.title}`,
        href: `/book/${j.slug}`,
      });
    } else {
      const s = seriesMap.get(r.itemId);
      if (!s) continue;
      map.set(userId, {
        label: `${verb} ${s.name}`,
        href: `/series/${s.slug}`,
      });
    }
  }
  return map;
}

/** Presence + reading status for a set of users (friends, group members). */
export async function presenceFor(
  users: RelatedUser[]
): Promise<FriendPresence[]> {
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);
  const rows = await db
    .select({
      id: user.id,
      lastSeenAt: user.lastSeenAt,
      showReadingActivity: user.showReadingActivity,
    })
    .from(user)
    .where(inArray(user.id, ids));
  const meta = new Map(rows.map((r) => [r.id, r]));

  const sharingIds = rows
    .filter((r) => r.showReadingActivity && isOnline(r.lastSeenAt))
    .map((r) => r.id);
  const activity = await currentActivity(sharingIds);

  return users.map((u) => {
    const m = meta.get(u.id);
    const online = isOnline(m?.lastSeenAt);
    const act = online ? activity.get(u.id) : undefined;
    return {
      ...u,
      online,
      activityLabel: act?.label ?? null,
      activityHref: act?.href ?? null,
    };
  });
}

/** The user's friends, annotated with presence — online first. */
export async function friendsWithPresence(
  userId: string
): Promise<FriendPresence[]> {
  const friends = await listFriends(userId);
  const withPresence = await presenceFor(friends);
  return withPresence.sort(
    (a, b) =>
      Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)
  );
}
