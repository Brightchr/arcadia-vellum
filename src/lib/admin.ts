import { db } from "@/db";
import {
  user,
  journals,
  series,
  savedItems,
  reviews,
  journalImages,
  journalAudio,
  playlists,
  playlistItems,
  follows,
  readingActivity,
  adminActions,
} from "@/db/schema";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { newId } from "@/lib/id";
import { notifyMany } from "@/lib/notifications";
import { listFollowers, listFollowing, listFriends } from "@/lib/social";
import { revokeAllSessions } from "@/lib/bans";

/** True when this user id holds the admin role. */
export async function isAdmin(userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId));
  return rows[0]?.role === "admin";
}

export interface AdminUserRow {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatarImageId: string | null;
  role: "user" | "admin";
  banned: boolean;
  bannedAt: Date | null;
  createdAt: Date;
}

/** All accounts (banned included), optionally filtered, newest first. */
export async function listUsersForAdmin(q?: string): Promise<AdminUserRow[]> {
  const term = q?.trim().replace(/^@/, "").replace(/[\\%_]/g, (c) => `\\${c}`);
  return db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatarImageId: user.avatarImageId,
      role: user.role,
      banned: user.banned,
      bannedAt: user.bannedAt,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(
      term
        ? or(
            ilike(user.name, `%${term}%`),
            ilike(user.username, `%${term}%`),
            ilike(user.email, `%${term}%`)
          )
        : undefined
    )
    .orderBy(desc(user.createdAt))
    .limit(200);
}

export async function adminStats() {
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [users, banned, works, reviewCount] = await Promise.all([
    count(db.select({ n: sql<number>`count(*)::int` }).from(user)),
    count(
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(user)
        .where(eq(user.banned, true))
    ),
    count(db.select({ n: sql<number>`count(*)::int` }).from(journals)),
    count(db.select({ n: sql<number>`count(*)::int` }).from(reviews)),
  ]);
  return { users, banned, works, reviews: reviewCount };
}

// ---------------------------------------------------------------------------
// Audit log — every moderation action leaves a permanent record.
// ---------------------------------------------------------------------------

export async function logAdminAction(
  adminId: string,
  action: string,
  targetUserId: string | null,
  details?: string
) {
  await db.insert(adminActions).values({
    id: newId(),
    adminId,
    action,
    targetUserId,
    details: details ?? null,
  });
}

export interface AdminActionView {
  action: string;
  details: string | null;
  createdAt: Date;
  adminName: string;
}

/** Moderation history for one account, newest first. */
export async function listActionsForUser(
  targetUserId: string
): Promise<AdminActionView[]> {
  return db
    .select({
      action: adminActions.action,
      details: adminActions.details,
      createdAt: adminActions.createdAt,
      adminName: user.name,
    })
    .from(adminActions)
    .innerJoin(user, eq(adminActions.adminId, user.id))
    .where(eq(adminActions.targetUserId, targetUserId))
    .orderBy(desc(adminActions.createdAt))
    .limit(50);
}

/**
 * Ban or unban a user. Banning hides their works, reviews, and profile
 * platform-wide (enforced in the access/discovery layers), refuses their
 * next sign-in with the given reason, signs them out everywhere, and
 * notifies everyone who had saved one of their works. A `days` duration
 * makes it a suspension that auto-expires.
 */
export async function setUserBanned(
  targetId: string,
  banned: boolean,
  opts?: { reason?: string | null; days?: number | null }
) {
  const bannedUntil =
    banned && opts?.days
      ? new Date(Date.now() + opts.days * 24 * 60 * 60 * 1000)
      : null;
  await db
    .update(user)
    .set({
      banned,
      bannedAt: banned ? new Date() : null,
      bannedUntil,
      banReason: banned ? (opts?.reason ?? null) : null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, targetId));
  if (!banned) return;
  // Kill their live sessions — the ban lands within the cookie-cache window.
  await revokeAllSessions(targetId);

  // Everyone who shelved one of the banned user's works gets a heads-up.
  const [ownJournals, ownSeries] = await Promise.all([
    db
      .select({ id: journals.id })
      .from(journals)
      .where(eq(journals.ownerId, targetId)),
    db
      .select({ id: series.id })
      .from(series)
      .where(eq(series.ownerId, targetId)),
  ]);
  const journalIds = ownJournals.map((j) => j.id);
  const seriesIds = ownSeries.map((s) => s.id);
  const conds = [];
  if (journalIds.length > 0) {
    conds.push(
      and(eq(savedItems.kind, "journal"), inArray(savedItems.itemId, journalIds))
    );
  }
  if (seriesIds.length > 0) {
    conds.push(
      and(eq(savedItems.kind, "series"), inArray(savedItems.itemId, seriesIds))
    );
  }
  if (conds.length === 0) return;
  const savers = await db
    .select({ userId: savedItems.userId })
    .from(savedItems)
    .where(or(...conds));
  await notifyMany(
    savers.map((s) => s.userId).filter((id) => id !== targetId),
    "user_banned",
    { actorId: targetId }
  );
}

/**
 * Take a work down or restore it. A taken-down work vanishes from the
 * store, search, series pages, and share links; the owner still sees it on
 * their own shelves, marked banned with the reason.
 */
export async function setWorkBanned(
  journalId: string,
  banned: boolean,
  reason?: string | null
) {
  await db
    .update(journals)
    .set({
      bannedAt: banned ? new Date() : null,
      banReason: banned ? (reason ?? null) : null,
    })
    .where(eq(journals.id, journalId));
}

// ---------------------------------------------------------------------------
// Per-user drill-down: everything an admin needs to judge an account.
// ---------------------------------------------------------------------------

export interface ActivityEvent {
  at: Date;
  label: string;
  href: string | null;
}

/** Full inspection view of one account (admin only — never expose publicly). */
export async function adminUserDetail(targetId: string) {
  const profile = (
    await db.select().from(user).where(eq(user.id, targetId))
  )[0];
  if (!profile) return null;

  const [
    works,
    ownSeries,
    images,
    audio,
    ownPlaylists,
    ownReviews,
    followers,
    following,
    friends,
    saves,
    reading,
    followedUsers,
    moderation,
  ] = await Promise.all([
    db
      .select({
        id: journals.id,
        title: journals.title,
        slug: journals.slug,
        sourceType: journals.sourceType,
        visibility: journals.visibility,
        listed: journals.listed,
        coverImageId: journals.coverImageId,
        seriesId: journals.seriesId,
        createdAt: journals.createdAt,
      })
      .from(journals)
      .where(eq(journals.ownerId, targetId))
      .orderBy(desc(journals.createdAt)),
    db
      .select({ id: series.id, name: series.name, slug: series.slug })
      .from(series)
      .where(eq(series.ownerId, targetId)),
    db
      .select({
        id: journalImages.id,
        journalId: journalImages.journalId,
        createdAt: journalImages.createdAt,
        bytes: sql<number>`coalesce(octet_length(${journalImages.data}), 0)::int`,
      })
      .from(journalImages)
      .innerJoin(journals, eq(journalImages.journalId, journals.id))
      .where(eq(journals.ownerId, targetId))
      .orderBy(desc(journalImages.createdAt))
      .limit(120),
    db
      .select({
        id: journalAudio.id,
        title: journalAudio.title,
        journalId: journalAudio.journalId,
        createdAt: journalAudio.createdAt,
        bytes: sql<number>`coalesce(octet_length(${journalAudio.data}), 0)::int`,
      })
      .from(journalAudio)
      .innerJoin(journals, eq(journalAudio.journalId, journals.id))
      .where(eq(journals.ownerId, targetId))
      .orderBy(desc(journalAudio.createdAt))
      .limit(200),
    db
      .select()
      .from(playlists)
      .where(eq(playlists.ownerId, targetId)),
    db
      .select()
      .from(reviews)
      .where(eq(reviews.userId, targetId))
      .orderBy(desc(reviews.updatedAt))
      .limit(100),
    listFollowers(targetId),
    listFollowing(targetId),
    listFriends(targetId),
    db
      .select()
      .from(savedItems)
      .where(eq(savedItems.userId, targetId))
      .orderBy(desc(savedItems.createdAt))
      .limit(100),
    db
      .select()
      .from(readingActivity)
      .where(eq(readingActivity.userId, targetId))
      .orderBy(desc(readingActivity.updatedAt))
      .limit(50),
    db
      .select({ followingId: follows.followingId, createdAt: follows.createdAt })
      .from(follows)
      .where(eq(follows.followerId, targetId))
      .orderBy(desc(follows.createdAt))
      .limit(50),
    listActionsForUser(targetId),
  ]);

  // Resolve titles referenced by reviews/saves/reading for the timeline.
  const journalIds = new Set<string>();
  const seriesIds = new Set<string>();
  for (const list of [ownReviews, saves, reading] as const) {
    for (const r of list) {
      if (r.kind === "journal") journalIds.add(r.itemId);
      else seriesIds.add(r.itemId);
    }
  }
  const [journalRefs, seriesRefs, followedRefs] = await Promise.all([
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
    followedUsers.length > 0
      ? db
          .select({ id: user.id, name: user.name, username: user.username })
          .from(user)
          .where(inArray(user.id, followedUsers.map((f) => f.followingId)))
      : Promise.resolve([]),
  ]);
  const jRef = new Map(journalRefs.map((j) => [j.id, j]));
  const sRef = new Map(seriesRefs.map((s) => [s.id, s]));
  const uRef = new Map(followedRefs.map((u) => [u.id, u]));
  const refTitle = (kind: string, id: string) =>
    kind === "journal" ? jRef.get(id)?.title : sRef.get(id)?.name;
  const refHref = (kind: string, id: string) => {
    if (kind === "journal") {
      const j = jRef.get(id);
      return j ? `/book/${j.slug}` : null;
    }
    const s = sRef.get(id);
    return s ? `/series/${s.slug}` : null;
  };

  // Timestamped activity timeline, newest first.
  const events: ActivityEvent[] = [
    ...works.map((w) => ({
      at: w.createdAt,
      label: `Bound "${w.title}" (${w.sourceType === "audio" ? "audiobook" : "book"}, ${w.visibility})`,
      href: `/book/${w.slug}`,
    })),
    ...ownReviews.map((r) => ({
      at: r.updatedAt,
      label: `Reviewed "${refTitle(r.kind, r.itemId) ?? "a removed work"}" — ${r.rating}/5${r.body ? `: "${r.body.slice(0, 80)}${r.body.length > 80 ? "..." : ""}"` : ""}`,
      href: refHref(r.kind, r.itemId),
    })),
    ...saves.map((s) => ({
      at: s.createdAt,
      label: `Saved "${refTitle(s.kind, s.itemId) ?? "a removed work"}"`,
      href: refHref(s.kind, s.itemId),
    })),
    ...reading.map((r) => ({
      at: r.updatedAt,
      label: `${r.mode === "listen" ? "Listened to" : "Read"} "${refTitle(r.kind, r.itemId) ?? "a removed work"}"`,
      href: refHref(r.kind, r.itemId),
    })),
    ...followedUsers.map((f) => {
      const u = uRef.get(f.followingId);
      return {
        at: f.createdAt,
        label: `Followed ${u ? u.name : "a user"}`,
        href: u?.username ? `/u/${u.username}` : null,
      };
    }),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 60);

  const playlistCounts = await (async () => {
    const ids = ownPlaylists.map((p) => p.id);
    if (ids.length === 0) return new Map<string, number>();
    const rows = await db
      .select({
        playlistId: playlistItems.playlistId,
        n: sql<number>`count(*)::int`,
      })
      .from(playlistItems)
      .where(inArray(playlistItems.playlistId, ids))
      .groupBy(playlistItems.playlistId);
    return new Map(rows.map((r) => [r.playlistId, r.n]));
  })();

  const journalTitleById = new Map(works.map((w) => [w.id, w.title]));

  return {
    profile,
    works,
    series: ownSeries,
    images: images.map((i) => ({
      ...i,
      journalTitle: journalTitleById.get(i.journalId) ?? "Unknown work",
    })),
    audio: audio.map((a) => ({
      ...a,
      journalTitle: journalTitleById.get(a.journalId) ?? "Unknown work",
    })),
    playlists: ownPlaylists.map((p) => ({
      ...p,
      count: playlistCounts.get(p.id) ?? 0,
    })),
    reviews: ownReviews.map((r) => ({
      ...r,
      itemTitle: refTitle(r.kind, r.itemId) ?? null,
      itemHref: refHref(r.kind, r.itemId),
    })),
    followers,
    following,
    friends,
    events,
    moderation,
  };
}
