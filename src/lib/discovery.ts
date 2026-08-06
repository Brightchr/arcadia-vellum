import { db } from "@/db";
import {
  journals,
  series,
  journalTags,
  tags,
  reviews,
  user,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Journal } from "@/lib/journals";

/**
 * A "work" is what discovery pages deal in: either a standalone journal or a
 * whole series (whose public volumes are its versions/episodes).
 */
export interface Work {
  kind: "journal" | "series";
  id: string;
  slug: string;
  title: string;
  author: string | null;
  theme: string;
  /** Contains audio volumes / written volumes (a mixed series has both). */
  hasAudio: boolean;
  hasWritten: boolean;
  volumeCount: number;
  coverImageId: string | null;
  /** True when access must be requested (lock badge on cards). */
  restricted: boolean;
  description: string | null;
  ownerId: string;
  ownerName: string;
  ownerUsername: string | null;
  tags: string[];
  avgRating: number | null;
  ratingCount: number;
}

interface RatingAgg {
  avg: number | null;
  count: number;
}

async function ratingAggregates(
  keys: { kind: "journal" | "series"; itemId: string }[]
): Promise<Map<string, RatingAgg>> {
  const map = new Map<string, RatingAgg>();
  if (keys.length === 0) return map;
  const ids = keys.map((k) => k.itemId);
  const rows = await db
    .select({
      kind: reviews.kind,
      itemId: reviews.itemId,
      avg: sql<number>`avg(${reviews.rating})::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(inArray(reviews.itemId, ids))
    .groupBy(reviews.kind, reviews.itemId);
  for (const r of rows) {
    map.set(`${r.kind}:${r.itemId}`, { avg: r.avg, count: r.count });
  }
  return map;
}

async function tagsForJournals(
  journalIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (journalIds.length === 0) return map;
  const rows = await db
    .select({ journalId: journalTags.journalId, name: tags.name })
    .from(journalTags)
    .innerJoin(tags, eq(journalTags.tagId, tags.id))
    .where(inArray(journalTags.journalId, journalIds));
  for (const r of rows) {
    map.set(r.journalId, [...(map.get(r.journalId) ?? []), r.name]);
  }
  return map;
}

function ownerInfo(
  owners: Map<string, { name: string; username: string | null }>,
  id: string
) {
  return owners.get(id) ?? { name: "Unknown", username: null };
}

/**
 * Assemble every public work, optionally filtered by search text, tag, and
 * type ("books" = has written volumes, "audiobooks" = has audio volumes).
 */
export async function listPublicWorks(filter: {
  q?: string;
  tag?: string;
  type?: "books" | "audiobooks";
} = {}): Promise<Work[]> {
  const publicJournals = await db
    .select()
    .from(journals)
    .where(
      and(
        inArray(journals.visibility, ["public", "restricted"]),
        eq(journals.listed, true)
      )
    );
  if (publicJournals.length === 0) return [];

  const seriesIds = [
    ...new Set(
      publicJournals.map((j) => j.seriesId).filter((x): x is string => !!x)
    ),
  ];
  const seriesRows =
    seriesIds.length > 0
      ? await db.select().from(series).where(inArray(series.id, seriesIds))
      : [];
  const ownerIds = [...new Set(publicJournals.map((j) => j.ownerId))];
  const ownerRows = await db
    .select({ id: user.id, name: user.name, username: user.username })
    .from(user)
    .where(inArray(user.id, ownerIds));
  const owners = new Map(
    ownerRows.map((o) => [o.id, { name: o.name, username: o.username }])
  );
  const tagMap = await tagsForJournals(publicJournals.map((j) => j.id));

  const works: Work[] = [];

  for (const s of seriesRows) {
    const volumes = publicJournals.filter((j) => j.seriesId === s.id);
    if (volumes.length === 0) continue;
    const workTags = [
      ...new Set(volumes.flatMap((v) => tagMap.get(v.id) ?? [])),
    ];
    const withCover = volumes.find((v) => v.coverImageId);
    const owner = ownerInfo(owners, s.ownerId);
    works.push({
      kind: "series",
      id: s.id,
      slug: s.slug,
      title: s.name,
      author: volumes.find((v) => v.author)?.author ?? null,
      theme: volumes[0].theme,
      hasAudio: volumes.some((v) => v.sourceType === "audio"),
      hasWritten: volumes.some((v) => v.sourceType !== "audio"),
      volumeCount: volumes.length,
      coverImageId: withCover?.coverImageId ?? null,
      restricted: volumes.every((v) => v.visibility === "restricted"),
      description: s.description,
      ownerId: s.ownerId,
      ownerName: owner.name,
      ownerUsername: owner.username,
      tags: workTags,
      avgRating: null,
      ratingCount: 0,
    });
  }

  for (const j of publicJournals.filter((j) => !j.seriesId)) {
    const owner = ownerInfo(owners, j.ownerId);
    works.push({
      kind: "journal",
      id: j.id,
      slug: j.slug,
      title: j.title,
      author: j.author,
      theme: j.theme,
      hasAudio: j.sourceType === "audio",
      hasWritten: j.sourceType !== "audio",
      volumeCount: 1,
      coverImageId: j.coverImageId,
      restricted: j.visibility === "restricted",
      description: j.description,
      ownerId: j.ownerId,
      ownerName: owner.name,
      ownerUsername: owner.username,
      tags: tagMap.get(j.id) ?? [],
      avgRating: null,
      ratingCount: 0,
    });
  }

  const ratings = await ratingAggregates(
    works.map((w) => ({ kind: w.kind, itemId: w.id }))
  );
  for (const w of works) {
    const agg = ratings.get(`${w.kind}:${w.id}`);
    if (agg) {
      w.avgRating = agg.avg;
      w.ratingCount = agg.count;
    }
  }

  let result = works;
  if (filter.type === "books") result = result.filter((w) => w.hasWritten);
  if (filter.type === "audiobooks") result = result.filter((w) => w.hasAudio);
  if (filter.tag) {
    const t = filter.tag.toLowerCase();
    result = result.filter((w) => w.tags.includes(t));
  }
  if (filter.q) {
    const q = filter.q.toLowerCase();
    result = result.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        (w.author ?? "").toLowerCase().includes(q) ||
        w.ownerName.toLowerCase().includes(q) ||
        w.tags.some((t) => t.includes(q))
    );
  }

  // Best-known first: rated works by average then count, then newest-ish.
  return result.sort(
    (a, b) =>
      (b.avgRating ?? 0) - (a.avgRating ?? 0) || b.ratingCount - a.ratingCount
  );
}

/** Resolve a public work (or the owner's private one) for its homepage. */
export async function workForJournal(
  journal: Journal
): Promise<Work> {
  const [works, tagMap] = await Promise.all([
    ratingAggregates([{ kind: "journal", itemId: journal.id }]),
    tagsForJournals([journal.id]),
  ]);
  const owner = await db
    .select({ name: user.name, username: user.username })
    .from(user)
    .where(eq(user.id, journal.ownerId));
  const agg = works.get(`journal:${journal.id}`);
  return {
    kind: "journal",
    id: journal.id,
    slug: journal.slug,
    title: journal.title,
    author: journal.author,
    theme: journal.theme,
    hasAudio: journal.sourceType === "audio",
    hasWritten: journal.sourceType !== "audio",
    volumeCount: 1,
    coverImageId: journal.coverImageId,
    restricted: journal.visibility === "restricted",
    description: journal.description,
    ownerId: journal.ownerId,
    ownerName: owner[0]?.name ?? "Unknown",
    ownerUsername: owner[0]?.username ?? null,
    tags: tagMap.get(journal.id) ?? [],
    avgRating: agg?.avg ?? null,
    ratingCount: agg?.count ?? 0,
  };
}

/** Work keys ("kind:id") the owner marked as featured for their profile. */
export async function featuredWorkKeys(ownerId: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: journals.id, seriesId: journals.seriesId })
    .from(journals)
    .where(and(eq(journals.ownerId, ownerId), eq(journals.featured, true)));
  return new Set(
    rows.map((r) => (r.seriesId ? `series:${r.seriesId}` : `journal:${r.id}`))
  );
}

/** True when the work exists and has a public face (for saves/reviews). */
export async function isWorkPublic(
  kind: "journal" | "series",
  itemId: string
): Promise<{ ok: boolean; ownerId: string | null }> {
  if (kind === "journal") {
    const rows = await db
      .select({ ownerId: journals.ownerId })
      .from(journals)
      .where(
        and(
          eq(journals.id, itemId),
          inArray(journals.visibility, ["public", "restricted"])
        )
      );
    return { ok: rows.length > 0, ownerId: rows[0]?.ownerId ?? null };
  }
  const rows = await db
    .select({ ownerId: series.ownerId })
    .from(series)
    .innerJoin(journals, eq(journals.seriesId, series.id))
    .where(
      and(
        eq(series.id, itemId),
        inArray(journals.visibility, ["public", "restricted"])
      )
    )
    .limit(1);
  return { ok: rows.length > 0, ownerId: rows[0]?.ownerId ?? null };
}

/** All tag names in use on public journals (for browse chips). */
export async function popularTags(limit = 24): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name, n: sql<number>`count(*)::int` })
    .from(journalTags)
    .innerJoin(tags, eq(journalTags.tagId, tags.id))
    .innerJoin(journals, eq(journalTags.journalId, journals.id))
    .where(eq(journals.visibility, "public"))
    .groupBy(tags.name)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows.map((r) => r.name);
}

/** Public volumes of a series plus owner-visible extras when isOwner. */
export async function seriesVolumes(seriesId: string, isOwner: boolean) {
  const rows = await db
    .select()
    .from(journals)
    .where(
      isOwner
        ? eq(journals.seriesId, seriesId)
        : and(
            eq(journals.seriesId, seriesId),
            inArray(journals.visibility, ["public", "restricted"])
          )
    );
  return rows;
}
