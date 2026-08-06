import { db } from "@/db";
import { reviews, savedItems } from "@/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";
import { listPublicWorks, type Work } from "@/lib/discovery";
import { listFollowing, listFriends, listFollowedSeriesIds } from "@/lib/social";

export interface HomeFeed {
  /** Fresh releases from followed scribes and followed series. */
  followedNew: Work[];
  /** Works friends saved or rated 4+ stars, most-endorsed first. */
  friendsRecommend: Work[];
  /** "Because you liked <tag>" rows, from the user's saves and high ratings. */
  tagRows: { tag: string; works: Work[] }[];
  bestReviewed: Work[];
  newAndNoteworthy: Work[];
  popular: Work[];
}

const key = (kind: string, id: string) => `${kind}:${id}`;

/** Work keys the user saved, plus keys they rated 4+ (their "likes"). */
async function likedKeys(userId: string): Promise<Set<string>> {
  const [saved, loved] = await Promise.all([
    db
      .select({ kind: savedItems.kind, itemId: savedItems.itemId })
      .from(savedItems)
      .where(eq(savedItems.userId, userId)),
    db
      .select({ kind: reviews.kind, itemId: reviews.itemId })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), gte(reviews.rating, 4))),
  ]);
  return new Set([...saved, ...loved].map((r) => key(r.kind, r.itemId)));
}

/**
 * The discovery feed for the home page. One shared pool of public works is
 * sliced per section; the user's own works and already-liked works are kept
 * out of the recommendation rows (but still count for the highlight rows).
 */
export async function homeFeed(userId: string): Promise<HomeFeed> {
  const [all, following, friends, followedSeries, liked] = await Promise.all([
    listPublicWorks(),
    listFollowing(userId),
    listFriends(userId),
    listFollowedSeriesIds(userId),
    likedKeys(userId),
  ]);

  const followingIds = new Set(following.map((u) => u.id));
  const followedSeriesIds = new Set(followedSeries);
  const notMine = all.filter((w) => w.ownerId !== userId);
  const fresh = (w: Work) => !liked.has(key(w.kind, w.id));

  // --- New from your follows ---------------------------------------------
  const followedNew = notMine
    .filter(
      (w) =>
        followingIds.has(w.ownerId) ||
        (w.kind === "series" && followedSeriesIds.has(w.id))
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  // --- Friends recommend ---------------------------------------------------
  let friendsRecommend: Work[] = [];
  const friendIds = friends.map((f) => f.id);
  if (friendIds.length > 0) {
    const [friendSaves, friendLoves] = await Promise.all([
      db
        .select({ kind: savedItems.kind, itemId: savedItems.itemId })
        .from(savedItems)
        .where(inArray(savedItems.userId, friendIds)),
      db
        .select({ kind: reviews.kind, itemId: reviews.itemId })
        .from(reviews)
        .where(
          and(inArray(reviews.userId, friendIds), gte(reviews.rating, 4))
        ),
    ]);
    const endorsements = new Map<string, number>();
    for (const r of [...friendSaves, ...friendLoves]) {
      const k = key(r.kind, r.itemId);
      endorsements.set(k, (endorsements.get(k) ?? 0) + 1);
    }
    friendsRecommend = notMine
      .filter(fresh)
      .filter((w) => endorsements.has(key(w.kind, w.id)))
      .sort(
        (a, b) =>
          (endorsements.get(key(b.kind, b.id)) ?? 0) -
            (endorsements.get(key(a.kind, a.id)) ?? 0) ||
          b.createdAt - a.createdAt
      );
  }

  // --- Because you liked <tag> --------------------------------------------
  const tagCounts = new Map<string, number>();
  for (const w of all) {
    if (!liked.has(key(w.kind, w.id))) continue;
    for (const t of w.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 3);
  const tagRows = topTags
    .map((tag) => ({
      tag,
      works: notMine.filter(fresh).filter((w) => w.tags.includes(tag)),
    }))
    .filter((row) => row.works.length > 0);

  // --- Highlights ----------------------------------------------------------
  const bestReviewed = all
    .filter((w) => w.ratingCount > 0)
    .sort(
      (a, b) =>
        (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.ratingCount - a.ratingCount
    );
  const newAndNoteworthy = [...all].sort((a, b) => b.createdAt - a.createdAt);
  const popScore = (w: Work) => w.saveCount * 2 + w.ratingCount;
  const popular = all
    .filter((w) => popScore(w) > 0)
    .sort((a, b) => popScore(b) - popScore(a) || b.createdAt - a.createdAt);

  return {
    followedNew,
    friendsRecommend,
    tagRows,
    bestReviewed,
    newAndNoteworthy,
    popular,
  };
}
