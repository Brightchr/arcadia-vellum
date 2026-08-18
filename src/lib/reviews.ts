import { db } from "@/db";
import { reviews, user } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { newId } from "@/lib/id";

export type WorkKind = "journal" | "series";

export interface ReviewWithAuthor {
  id: string;
  userId: string;
  rating: number;
  body: string | null;
  updatedAt: Date;
  authorName: string;
  authorUsername: string | null;
  authorAvatarId: string | null;
  authorRole: "user" | "admin";
}

/** Reviews with authors resolved; banned users' reviews are hidden. */
export async function listReviews(
  kind: WorkKind,
  itemId: string
): Promise<ReviewWithAuthor[]> {
  const rows = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      rating: reviews.rating,
      body: reviews.body,
      updatedAt: reviews.updatedAt,
      authorName: user.name,
      authorUsername: user.username,
      authorAvatarId: user.avatarImageId,
      authorRole: user.role,
    })
    .from(reviews)
    .innerJoin(user, eq(reviews.userId, user.id))
    .where(
      and(
        eq(reviews.kind, kind),
        eq(reviews.itemId, itemId),
        eq(user.banned, false)
      )
    )
    .orderBy(desc(reviews.updatedAt))
    // Newest 100 — an unbounded review list grows the page payload forever.
    .limit(100);
  return rows;
}

export async function upsertReview(
  userId: string,
  kind: WorkKind,
  itemId: string,
  rating: number,
  body: string | null
) {
  const existing = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.userId, userId),
        eq(reviews.kind, kind),
        eq(reviews.itemId, itemId)
      )
    );
  if (existing[0]) {
    await db
      .update(reviews)
      .set({ rating, body, updatedAt: new Date() })
      .where(eq(reviews.id, existing[0].id));
    return existing[0].id;
  }
  const id = newId();
  await db
    .insert(reviews)
    .values({ id, userId, kind, itemId, rating, body });
  return id;
}

export async function deleteReview(
  userId: string,
  kind: WorkKind,
  itemId: string
) {
  await db
    .delete(reviews)
    .where(
      and(
        eq(reviews.userId, userId),
        eq(reviews.kind, kind),
        eq(reviews.itemId, itemId)
      )
    );
}
