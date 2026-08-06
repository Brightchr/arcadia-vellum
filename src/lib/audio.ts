import { db } from "@/db";
import { journalAudio, journals } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { newId } from "@/lib/id";

export const AUDIO_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const MAX_AUDIO_MB = MAX_AUDIO_BYTES / 1024 / 1024;

export interface AudioEntry {
  /** First segment's id — used as the entry's stable identity. */
  id: string;
  title: string;
  sortIndex: number;
  contentType: string;
  /** All segment audio ids in play order (length 1 for single-file entries). */
  segmentIds: string[];
}

/**
 * Entries (player chapters) without the audio bytes. Rows sharing a
 * sortIndex collapse into one entry whose segments play back-to-back.
 */
export async function listTracks(journalId: string): Promise<AudioEntry[]> {
  const rows = await db
    .select({
      id: journalAudio.id,
      title: journalAudio.title,
      sortIndex: journalAudio.sortIndex,
      segmentIndex: journalAudio.segmentIndex,
      contentType: journalAudio.contentType,
    })
    .from(journalAudio)
    .where(eq(journalAudio.journalId, journalId))
    .orderBy(
      asc(journalAudio.sortIndex),
      asc(journalAudio.segmentIndex),
      asc(journalAudio.createdAt)
    );

  const entries: AudioEntry[] = [];
  for (const row of rows) {
    const current = entries[entries.length - 1];
    if (current && current.sortIndex === row.sortIndex) {
      current.segmentIds.push(row.id);
    } else {
      entries.push({
        id: row.id,
        title: row.title,
        sortIndex: row.sortIndex,
        contentType: row.contentType,
        segmentIds: [row.id],
      });
    }
  }
  return entries;
}

/** Entry counts per journal for all of an owner's journals (for the dashboard). */
export async function trackCountsForOwner(ownerId: string) {
  const rows = await db
    .select({
      journalId: journalAudio.journalId,
      count: sql<number>`count(distinct ${journalAudio.sortIndex})::int`,
    })
    .from(journalAudio)
    .innerJoin(journals, eq(journalAudio.journalId, journals.id))
    .where(eq(journals.ownerId, ownerId))
    .groupBy(journalAudio.journalId);
  return Object.fromEntries(rows.map((r) => [r.journalId, r.count]));
}

export async function getTrack(id: string) {
  const rows = await db
    .select()
    .from(journalAudio)
    .where(eq(journalAudio.id, id));
  return rows[0] ?? null;
}

/**
 * Adds one entry. Multiple files become segments of the same entry and play
 * back-to-back as a single chapter in the player.
 */
export async function addEntry(
  journalId: string,
  title: string,
  files: { contentType: string; data: Buffer }[]
) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${journalAudio.sortIndex})` })
    .from(journalAudio)
    .where(eq(journalAudio.journalId, journalId));
  const sortIndex = (row?.max ?? -1) + 1;

  const values = files.map((file, segmentIndex) => ({
    id: newId(),
    journalId,
    title: title.slice(0, 120),
    sortIndex,
    segmentIndex,
    contentType: file.contentType,
    data: file.data,
  }));
  await db.insert(journalAudio).values(values);
  return { id: values[0].id, title: values[0].title, parts: values.length };
}

/** Deletes the whole entry (every segment) that the given row belongs to. */
export async function deleteEntryByTrackId(id: string) {
  const track = await getTrack(id);
  if (!track) return;
  await db
    .delete(journalAudio)
    .where(
      and(
        eq(journalAudio.journalId, track.journalId),
        eq(journalAudio.sortIndex, track.sortIndex)
      )
    );
}
