import { db } from "@/db";
import { user, journals, series, savedItems, reviews } from "@/db/schema";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { notifyMany } from "@/lib/notifications";

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

/**
 * Ban or unban a user. Banning hides their works, reviews, and profile
 * platform-wide (enforced in the access/discovery layers) and notifies
 * everyone who had saved one of their works.
 */
export async function setUserBanned(targetId: string, banned: boolean) {
  await db
    .update(user)
    .set({
      banned,
      bannedAt: banned ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, targetId));
  if (!banned) return;

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
