import { db } from "@/db";
import { readingActivity, journals, series } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export type ActivityMode = "read" | "listen";

/** Record (or refresh) that the user opened a work. Fire-and-forget safe. */
export async function recordActivity(
  userId: string,
  kind: "journal" | "series",
  itemId: string,
  mode: ActivityMode
) {
  try {
    await db
      .insert(readingActivity)
      .values({ userId, kind, itemId, mode, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [readingActivity.userId, readingActivity.kind, readingActivity.itemId],
        set: { mode, updatedAt: new Date() },
      });
  } catch {
    // Activity tracking must never break a page view.
  }
}

export interface ActivityEntry {
  kind: "journal" | "series";
  itemId: string;
  mode: ActivityMode;
  title: string;
  theme: string;
  coverImageId: string | null;
  /** Where "continue" goes: reader or listen page. */
  href: string;
}

/** The user's recently opened works, most recent first. */
export async function listRecentActivity(
  userId: string,
  limit = 6
): Promise<ActivityEntry[]> {
  const rows = await db
    .select()
    .from(readingActivity)
    .where(eq(readingActivity.userId, userId))
    .orderBy(desc(readingActivity.updatedAt))
    .limit(limit * 2);

  const out: ActivityEntry[] = [];
  for (const row of rows) {
    if (out.length >= limit) break;
    if (row.kind === "journal") {
      const j = await db
        .select()
        .from(journals)
        .where(eq(journals.id, row.itemId));
      const journal = j[0];
      if (!journal) continue;
      if (journal.visibility !== "public" && journal.ownerId !== userId) continue;
      out.push({
        kind: "journal",
        itemId: row.itemId,
        mode: row.mode as ActivityMode,
        title: journal.title,
        theme: journal.theme,
        coverImageId: journal.coverImageId,
        href:
          row.mode === "listen" || journal.sourceType === "audio"
            ? `/j/${journal.slug}/listen`
            : `/j/${journal.slug}`,
      });
    } else {
      const s = await db.select().from(series).where(eq(series.id, row.itemId));
      const sr = s[0];
      if (!sr) continue;
      const vols = await db
        .select({ theme: journals.theme, coverImageId: journals.coverImageId })
        .from(journals)
        .where(and(eq(journals.seriesId, sr.id)))
        .limit(1);
      out.push({
        kind: "series",
        itemId: row.itemId,
        mode: row.mode as ActivityMode,
        title: sr.name,
        theme: vols[0]?.theme ?? "witch-grimoire",
        coverImageId: vols[0]?.coverImageId ?? null,
        href: row.mode === "listen" ? `/s/${sr.slug}/listen` : `/s/${sr.slug}`,
      });
    }
  }
  return out;
}
