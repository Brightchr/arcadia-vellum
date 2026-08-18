import { db } from "@/db";
import {
  journals,
  readingActivity,
  reviews,
  savedItems,
  shareLinks,
  user,
  workViews,
} from "@/db/schema";
import { and, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";

/**
 * Author analytics for the Home page: who's reading, how many reads, and
 * what reviewers are saying. All reads are batched — this renders on every
 * Home visit.
 */

const CHART_DAYS = 28;
/** Matches the presence activity window — "reading right now". */
const READER_WINDOW_MS = 90 * 60 * 1000;

function utcDay(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Count a reader opening a work — one upsert per open, rolled up per day.
 * Owners don't count themselves.
 */
export async function recordView(
  journalId: string,
  ownerId: string,
  viewerId: string | null
): Promise<void> {
  if (viewerId === ownerId) return;
  await db
    .insert(workViews)
    .values({ journalId, day: utcDay(), views: 1 })
    .onConflictDoUpdate({
      target: [workViews.journalId, workViews.day],
      set: { views: sql`${workViews.views} + 1` },
    });
}

export interface AuthorStats {
  totalViews: number;
  views28: number;
  viewsByDay: { day: string; views: number }[];
  viewsByWork: { journalId: string; title: string; views: number }[];
  totalSaves: number;
  reviewCount: number;
  avgRating: number | null;
  shareOpens: number;
  currentReaders: {
    readerName: string | null;
    workTitle: string;
    mode: string;
  }[];
  recentReviews: {
    reviewerName: string;
    reviewerUsername: string | null;
    reviewerAvatarId: string | null;
    rating: number;
    body: string | null;
    workTitle: string;
    workSlug: string;
    at: Date;
  }[];
}

export async function authorStats(ownerId: string): Promise<AuthorStats> {
  const myWorks = await db
    .select({ id: journals.id, title: journals.title, slug: journals.slug })
    .from(journals)
    .where(eq(journals.ownerId, ownerId));
  const ids = myWorks.map((w) => w.id);
  const titleById = new Map(myWorks.map((w) => [w.id, w.title]));
  const empty: AuthorStats = {
    totalViews: 0,
    views28: 0,
    viewsByDay: [],
    viewsByWork: [],
    totalSaves: 0,
    reviewCount: 0,
    avgRating: null,
    shareOpens: 0,
    currentReaders: [],
    recentReviews: [],
  };
  if (ids.length === 0) return empty;

  const since = utcDay(CHART_DAYS - 1);
  const readerCutoff = new Date(Date.now() - READER_WINDOW_MS);

  const [
    totals,
    dayRows,
    workRows,
    saveRow,
    ratingRow,
    shareRow,
    readerRows,
    reviewRows,
  ] = await Promise.all([
    db
      .select({ n: sql<number>`coalesce(sum(${workViews.views}), 0)::int` })
      .from(workViews)
      .where(inArray(workViews.journalId, ids)),
    db
      .select({
        day: workViews.day,
        views: sql<number>`sum(${workViews.views})::int`,
      })
      .from(workViews)
      .where(and(inArray(workViews.journalId, ids), gte(workViews.day, since)))
      .groupBy(workViews.day)
      .orderBy(workViews.day),
    db
      .select({
        journalId: workViews.journalId,
        views: sql<number>`sum(${workViews.views})::int`,
      })
      .from(workViews)
      .where(inArray(workViews.journalId, ids))
      .groupBy(workViews.journalId)
      .orderBy(desc(sql`sum(${workViews.views})`))
      .limit(8),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(savedItems)
      .where(
        and(eq(savedItems.kind, "journal"), inArray(savedItems.itemId, ids))
      ),
    db
      .select({
        n: sql<number>`count(*)::int`,
        avg: sql<number>`avg(${reviews.rating})::float`,
      })
      .from(reviews)
      .where(and(eq(reviews.kind, "journal"), inArray(reviews.itemId, ids))),
    db
      .select({ n: sql<number>`coalesce(sum(${shareLinks.openCount}), 0)::int` })
      .from(shareLinks)
      .where(eq(shareLinks.ownerId, ownerId)),
    db
      .select({
        itemId: readingActivity.itemId,
        mode: readingActivity.mode,
        readerName: user.name,
        sharing: user.showReadingActivity,
      })
      .from(readingActivity)
      .innerJoin(user, eq(readingActivity.userId, user.id))
      .where(
        and(
          eq(readingActivity.kind, "journal"),
          inArray(readingActivity.itemId, ids),
          gt(readingActivity.updatedAt, readerCutoff)
        )
      )
      .limit(20),
    db
      .select({
        reviewerName: user.name,
        reviewerUsername: user.username,
        reviewerAvatarId: user.avatarImageId,
        rating: reviews.rating,
        body: reviews.body,
        itemId: reviews.itemId,
        at: reviews.updatedAt,
      })
      .from(reviews)
      .innerJoin(user, eq(reviews.userId, user.id))
      .where(and(eq(reviews.kind, "journal"), inArray(reviews.itemId, ids)))
      .orderBy(desc(reviews.updatedAt))
      .limit(10),
  ]);

  // Dense 28-day series so charts show flat zero days, not gaps.
  const byDay = new Map(dayRows.map((r) => [r.day, r.views]));
  const viewsByDay: { day: string; views: number }[] = [];
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const day = utcDay(i);
    viewsByDay.push({ day, views: byDay.get(day) ?? 0 });
  }

  const slugById = new Map(myWorks.map((w) => [w.id, w.slug]));
  return {
    totalViews: totals[0]?.n ?? 0,
    views28: viewsByDay.reduce((sum, d) => sum + d.views, 0),
    viewsByDay,
    viewsByWork: workRows.map((r) => ({
      journalId: r.journalId,
      title: titleById.get(r.journalId) ?? "Removed work",
      views: r.views,
    })),
    totalSaves: saveRow[0]?.n ?? 0,
    reviewCount: ratingRow[0]?.n ?? 0,
    avgRating: ratingRow[0]?.n ? ratingRow[0].avg : null,
    shareOpens: shareRow[0]?.n ?? 0,
    // Readers who share their activity are named; the rest stay anonymous.
    currentReaders: readerRows.map((r) => ({
      readerName: r.sharing ? r.readerName : null,
      workTitle: titleById.get(r.itemId) ?? "a work",
      mode: r.mode,
    })),
    recentReviews: reviewRows.map((r) => ({
      reviewerName: r.reviewerName,
      reviewerUsername: r.reviewerUsername,
      reviewerAvatarId: r.reviewerAvatarId,
      rating: r.rating,
      body: r.body,
      workTitle: titleById.get(r.itemId) ?? "Removed work",
      workSlug: slugById.get(r.itemId) ?? "",
      at: r.at,
    })),
  };
}
