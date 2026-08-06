import { db } from "@/db";
import { follows, friendships, seriesFollows, user } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { newId } from "@/lib/id";

export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) return;
  await db
    .insert(follows)
    .values({ followerId, followingId })
    .onConflictDoNothing();
}

export async function unfollowUser(followerId: string, followingId: string) {
  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    );
}

export async function isFollowing(followerId: string, followingId: string) {
  const rows = await db
    .select({ f: follows.followerId })
    .from(follows)
    .where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    );
  return rows.length > 0;
}

// --- Series follows -------------------------------------------------------

export async function followSeries(userId: string, seriesId: string) {
  await db
    .insert(seriesFollows)
    .values({ userId, seriesId })
    .onConflictDoNothing();
}

export async function unfollowSeries(userId: string, seriesId: string) {
  await db
    .delete(seriesFollows)
    .where(
      and(
        eq(seriesFollows.userId, userId),
        eq(seriesFollows.seriesId, seriesId)
      )
    );
}

export async function isFollowingSeries(userId: string, seriesId: string) {
  const rows = await db
    .select({ u: seriesFollows.userId })
    .from(seriesFollows)
    .where(
      and(
        eq(seriesFollows.userId, userId),
        eq(seriesFollows.seriesId, seriesId)
      )
    );
  return rows.length > 0;
}

export async function seriesFollowerIds(seriesId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: seriesFollows.userId })
    .from(seriesFollows)
    .where(eq(seriesFollows.seriesId, seriesId));
  return rows.map((r) => r.userId);
}

export async function followerIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(eq(follows.followingId, userId));
  return rows.map((r) => r.followerId);
}

/** The friendship row between two users, in either direction. */
export async function friendshipBetween(a: string, b: string) {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
        and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a))
      )
    );
  return rows[0] ?? null;
}

export async function requestFriendship(requesterId: string, addresseeId: string) {
  if (requesterId === addresseeId) return null;
  const existing = await friendshipBetween(requesterId, addresseeId);
  if (existing) return existing;
  const [row] = await db
    .insert(friendships)
    .values({ id: newId(), requesterId, addresseeId, status: "pending" })
    .returning();
  return row;
}

/** Accept — only the addressee of a pending request may do this. */
export async function acceptFriendship(userId: string, otherId: string) {
  const existing = await friendshipBetween(userId, otherId);
  if (!existing || existing.status !== "pending") return false;
  if (existing.addresseeId !== userId) return false;
  await db
    .update(friendships)
    .set({ status: "accepted" })
    .where(eq(friendships.id, existing.id));
  return true;
}

/** Decline a request or end a friendship — either side may do this. */
export async function removeFriendship(userId: string, otherId: string) {
  const existing = await friendshipBetween(userId, otherId);
  if (!existing) return;
  await db.delete(friendships).where(eq(friendships.id, existing.id));
}

export interface RelatedUser {
  id: string;
  name: string;
  username: string | null;
  avatarImageId: string | null;
}

const userCols = {
  id: user.id,
  name: user.name,
  username: user.username,
  avatarImageId: user.avatarImageId,
};

export async function listFriends(userId: string): Promise<RelatedUser[]> {
  const asRequester = await db
    .select(userCols)
    .from(friendships)
    .innerJoin(user, eq(friendships.addresseeId, user.id))
    .where(
      and(eq(friendships.requesterId, userId), eq(friendships.status, "accepted"))
    );
  const asAddressee = await db
    .select(userCols)
    .from(friendships)
    .innerJoin(user, eq(friendships.requesterId, user.id))
    .where(
      and(eq(friendships.addresseeId, userId), eq(friendships.status, "accepted"))
    );
  return [...asRequester, ...asAddressee];
}

export async function listPendingRequests(userId: string) {
  const incoming = await db
    .select(userCols)
    .from(friendships)
    .innerJoin(user, eq(friendships.requesterId, user.id))
    .where(
      and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending"))
    );
  const outgoing = await db
    .select(userCols)
    .from(friendships)
    .innerJoin(user, eq(friendships.addresseeId, user.id))
    .where(
      and(eq(friendships.requesterId, userId), eq(friendships.status, "pending"))
    );
  return { incoming, outgoing };
}

export async function listFollowing(userId: string): Promise<RelatedUser[]> {
  return db
    .select(userCols)
    .from(follows)
    .innerJoin(user, eq(follows.followingId, user.id))
    .where(eq(follows.followerId, userId));
}

export async function listFollowers(userId: string): Promise<RelatedUser[]> {
  return db
    .select(userCols)
    .from(follows)
    .innerJoin(user, eq(follows.followerId, user.id))
    .where(eq(follows.followingId, userId));
}
