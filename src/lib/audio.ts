import { db } from "@/db";
import { journalAudio, journals } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { newId } from "@/lib/id";

export const AUDIO_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

export const MAX_AUDIO_BYTES = 40 * 1024 * 1024;

/** Track list without the audio bytes (for players and settings). */
export async function listTracks(journalId: string) {
  return db
    .select({
      id: journalAudio.id,
      title: journalAudio.title,
      sortIndex: journalAudio.sortIndex,
      contentType: journalAudio.contentType,
    })
    .from(journalAudio)
    .where(eq(journalAudio.journalId, journalId))
    .orderBy(asc(journalAudio.sortIndex), asc(journalAudio.createdAt));
}

/** Track counts per journal for all of an owner's journals (for the dashboard). */
export async function trackCountsForOwner(ownerId: string) {
  const rows = await db
    .select({
      journalId: journalAudio.journalId,
      count: sql<number>`count(*)::int`,
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

export async function addTrack(
  journalId: string,
  title: string,
  contentType: string,
  data: Buffer
) {
  const [row] = await db
    .select({ max: sql<number | null>`max(${journalAudio.sortIndex})` })
    .from(journalAudio)
    .where(eq(journalAudio.journalId, journalId));
  const sortIndex = (row?.max ?? -1) + 1;
  const [track] = await db
    .insert(journalAudio)
    .values({
      id: newId(),
      journalId,
      title: title.slice(0, 120),
      sortIndex,
      contentType,
      data,
    })
    .returning({ id: journalAudio.id, title: journalAudio.title });
  return track;
}

export async function deleteTrack(id: string) {
  await db.delete(journalAudio).where(eq(journalAudio.id, id));
}
