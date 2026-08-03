import { db } from "@/db";
import { series, journals } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { newId, slugify } from "@/lib/id";

export type Series = typeof series.$inferSelect;

export async function listSeriesForOwner(ownerId: string) {
  return db
    .select()
    .from(series)
    .where(eq(series.ownerId, ownerId))
    .orderBy(asc(series.createdAt));
}

export async function getSeriesBySlug(slug: string) {
  const rows = await db.select().from(series).where(eq(series.slug, slug));
  return rows[0] ?? null;
}

/** Case-insensitive find-or-create by name, scoped to the owner. */
export async function findOrCreateSeries(ownerId: string, name: string) {
  const trimmed = name.trim().slice(0, 80);
  const rows = await db
    .select()
    .from(series)
    .where(
      and(
        eq(series.ownerId, ownerId),
        sql`lower(${series.name}) = lower(${trimmed})`
      )
    );
  if (rows[0]) return rows[0];
  const [row] = await db
    .insert(series)
    .values({ id: newId(), ownerId, name: trimmed, slug: slugify(trimmed) })
    .returning();
  return row;
}

/** Volumes of a series in reading order (volume number, then age). */
export async function listVolumes(seriesId: string) {
  return db
    .select()
    .from(journals)
    .where(eq(journals.seriesId, seriesId))
    .orderBy(
      sql`${journals.volumeNumber} ASC NULLS LAST`,
      asc(journals.createdAt)
    );
}

/** Removes a series if no journals point at it anymore. */
export async function deleteSeriesIfEmpty(seriesId: string) {
  const rows = await db
    .select({ id: journals.id })
    .from(journals)
    .where(eq(journals.seriesId, seriesId))
    .limit(1);
  if (rows.length === 0) {
    await db.delete(series).where(eq(series.id, seriesId));
  }
}

/** Next free volume number in a series (max + 1). */
export async function nextVolumeNumber(seriesId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`max(${journals.volumeNumber})` })
    .from(journals)
    .where(eq(journals.seriesId, seriesId));
  return (row?.max ?? 0) + 1;
}
