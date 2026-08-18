import { db } from "@/db";
import { savedItems, journals, series } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { WorkKind } from "@/lib/reviews";
import { bannedUserIds } from "@/lib/profile";

export async function isSaved(userId: string, kind: WorkKind, itemId: string) {
  const rows = await db
    .select({ itemId: savedItems.itemId })
    .from(savedItems)
    .where(
      and(
        eq(savedItems.userId, userId),
        eq(savedItems.kind, kind),
        eq(savedItems.itemId, itemId)
      )
    );
  return rows.length > 0;
}

export async function saveItem(userId: string, kind: WorkKind, itemId: string) {
  await db
    .insert(savedItems)
    .values({ userId, kind, itemId })
    .onConflictDoNothing();
}

export async function unsaveItem(
  userId: string,
  kind: WorkKind,
  itemId: string
) {
  await db
    .delete(savedItems)
    .where(
      and(
        eq(savedItems.userId, userId),
        eq(savedItems.kind, kind),
        eq(savedItems.itemId, itemId)
      )
    );
}

/**
 * The user's saved works, newest first, resolved to slugs/titles. Works of
 * banned scribes drop out (savers get a notification when the ban lands).
 */
export async function listSaved(userId: string) {
  // Runs inside shellData() on every authenticated page render — this must
  // be a fixed number of queries, never one per saved row.
  const rows = await db
    .select()
    .from(savedItems)
    .where(eq(savedItems.userId, userId))
    .orderBy(desc(savedItems.createdAt))
    .limit(200);

  const journalIds = rows.filter((r) => r.kind === "journal").map((r) => r.itemId);
  const seriesIds = rows.filter((r) => r.kind === "series").map((r) => r.itemId);
  const [journalRows, seriesRows] = await Promise.all([
    journalIds.length > 0
      ? db
          .select({
            id: journals.id,
            slug: journals.slug,
            title: journals.title,
            ownerId: journals.ownerId,
          })
          .from(journals)
          .where(
            and(
              inArray(journals.id, journalIds),
              inArray(journals.visibility, ["public", "restricted"])
            )
          )
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db
          .select({ id: series.id, slug: series.slug, name: series.name, ownerId: series.ownerId })
          .from(series)
          .where(inArray(series.id, seriesIds))
      : Promise.resolve([]),
  ]);
  const jRef = new Map(journalRows.map((j) => [j.id, j]));
  const sRef = new Map(seriesRows.map((s) => [s.id, s]));

  const out: {
    kind: WorkKind;
    id: string;
    slug: string;
    title: string;
    icon: string | null;
    ownerId: string;
  }[] = [];
  for (const row of rows) {
    if (row.kind === "series") {
      const s = sRef.get(row.itemId);
      if (s) {
        out.push({
          kind: "series",
          id: row.itemId,
          slug: s.slug,
          title: s.name,
          icon: row.icon,
          ownerId: s.ownerId,
        });
      }
    } else {
      const j = jRef.get(row.itemId);
      if (j) {
        out.push({
          kind: "journal",
          id: row.itemId,
          slug: j.slug,
          title: j.title,
          icon: row.icon,
          ownerId: j.ownerId,
        });
      }
    }
  }
  const banned = await bannedUserIds([...new Set(out.map((o) => o.ownerId))]);
  return out.filter((o) => !banned.has(o.ownerId));
}
