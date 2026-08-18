import { db } from "@/db";
import {
  readingActivity,
  reviews,
  savedItems,
  userDislikes,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
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

// ---------------------------------------------------------------------------
// Taste profile — a per-user tag-affinity map built from how they actually
// use the platform. It shapes the store's default ordering ("For you") and
// keeps disliked works out of every discovery surface.
// ---------------------------------------------------------------------------

export interface TasteProfile {
  /** tag → signed weight. Positive = into it, negative = shown distaste. */
  affinity: Map<string, number>;
  /** "kind:id" keys the user marked Not Interested — never show these. */
  disliked: Set<string>;
  /** False for brand-new accounts: fall back to the simple default order. */
  hasSignals: boolean;
}

/** Work keys ("kind:id") the user marked Not Interested. */
export async function dislikedKeys(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ kind: userDislikes.kind, itemId: userDislikes.itemId })
    .from(userDislikes)
    .where(eq(userDislikes.userId, userId));
  return new Set(rows.map((r) => key(r.kind, r.itemId)));
}

/**
 * Build the profile against a pool of works (the store's current listing).
 * Signal weights: save +3, loved review (4-5★) +3, opened to read/listen +2,
 * panned review (1-2★) -2, Not Interested -3.
 */
export async function tasteProfile(
  userId: string,
  pool: Work[]
): Promise<TasteProfile> {
  // Recent signals only — history tables grow forever, and 200 recent
  // interactions describe taste as well as a lifetime of them.
  const [saves, loved, panned, opened, disliked] = await Promise.all([
    db
      .select({ kind: savedItems.kind, itemId: savedItems.itemId })
      .from(savedItems)
      .where(eq(savedItems.userId, userId))
      .orderBy(desc(savedItems.createdAt))
      .limit(200),
    db
      .select({ kind: reviews.kind, itemId: reviews.itemId })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), gte(reviews.rating, 4)))
      .orderBy(desc(reviews.updatedAt))
      .limit(200),
    db
      .select({ kind: reviews.kind, itemId: reviews.itemId })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), lte(reviews.rating, 2)))
      .orderBy(desc(reviews.updatedAt))
      .limit(200),
    db
      .select({ kind: readingActivity.kind, itemId: readingActivity.itemId })
      .from(readingActivity)
      .where(eq(readingActivity.userId, userId))
      .orderBy(desc(readingActivity.updatedAt))
      .limit(200),
    dislikedKeys(userId),
  ]);

  const tagsByKey = new Map(pool.map((w) => [key(w.kind, w.id), w.tags]));
  const affinity = new Map<string, number>();
  let signals = 0;
  const add = (
    rows: { kind: string; itemId: string }[] | string[],
    weight: number
  ) => {
    for (const r of rows) {
      const k = typeof r === "string" ? r : key(r.kind, r.itemId);
      const workTags = tagsByKey.get(k);
      if (!workTags) continue;
      signals++;
      for (const t of workTags) {
        affinity.set(t, (affinity.get(t) ?? 0) + weight);
      }
    }
  };
  add(saves, 3);
  add(loved, 3);
  add(opened, 2);
  add(panned, -2);
  add([...disliked], -3);

  return { affinity, disliked, hasSignals: signals > 0 };
}

/**
 * "For you" score: tag affinity carries the order; a light quality/popularity
 * term breaks ties so empty-tag works still rank sensibly.
 */
export function personalScore(w: Work, profile: TasteProfile): number {
  let tagScore = 0;
  for (const t of w.tags) tagScore += profile.affinity.get(t) ?? 0;
  const quality = (w.avgRating ?? 0) * Math.min(w.ratingCount, 10);
  const popularity = Math.min(w.saveCount, 20);
  return tagScore * 10 + quality + popularity;
}

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
  const [pool, following, friends, followedSeries, liked, disliked] =
    await Promise.all([
      listPublicWorks(),
      listFollowing(userId),
      listFriends(userId),
      listFollowedSeriesIds(userId),
      likedKeys(userId),
      dislikedKeys(userId),
    ]);

  // Not Interested removes a work from every discovery row.
  const all = pool.filter((w) => !disliked.has(key(w.kind, w.id)));
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
