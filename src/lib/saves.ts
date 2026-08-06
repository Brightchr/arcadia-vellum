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
  const rows = await db
    .select()
    .from(savedItems)
    .where(eq(savedItems.userId, userId))
    .orderBy(desc(savedItems.createdAt));

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
      const s = await db
        .select({ slug: series.slug, name: series.name, ownerId: series.ownerId })
        .from(series)
        .where(eq(series.id, row.itemId));
      if (s[0]) {
        out.push({
          kind: "series",
          id: row.itemId,
          slug: s[0].slug,
          title: s[0].name,
          icon: row.icon,
          ownerId: s[0].ownerId,
        });
      }
    } else {
      const j = await db
        .select({
          slug: journals.slug,
          title: journals.title,
          ownerId: journals.ownerId,
        })
        .from(journals)
        .where(
          and(
            eq(journals.id, row.itemId),
            inArray(journals.visibility, ["public", "restricted"])
          )
        );
      if (j[0]) {
        out.push({
          kind: "journal",
          id: row.itemId,
          slug: j[0].slug,
          title: j[0].title,
          icon: row.icon,
          ownerId: j[0].ownerId,
        });
      }
    }
  }
  const banned = await bannedUserIds([...new Set(out.map((o) => o.ownerId))]);
  return out.filter((o) => !banned.has(o.ownerId));
}
