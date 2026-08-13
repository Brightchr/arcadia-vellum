import { db } from "@/db";
import { journalAudio, journalImages, profileImages } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { newId } from "@/lib/id";
import {
  deleteObjects,
  presignGetUrl,
  putObject,
  storageEnabled,
} from "@/lib/storage";

/**
 * Media persistence: one place that decides where bytes live. With a bucket
 * configured, new uploads go to object storage and rows carry a storageKey;
 * without one (or for legacy rows) bytes stay in Postgres. Serving handles
 * both shapes forever, so no flag day is ever needed.
 */

// --- Saving -----------------------------------------------------------------

export async function saveJournalImage(
  journalId: string,
  contentType: string,
  data: Buffer
): Promise<string> {
  const id = newId();
  if (storageEnabled()) {
    const storageKey = `journal-images/${journalId}/${id}`;
    await putObject(storageKey, data, contentType);
    await db
      .insert(journalImages)
      .values({ id, journalId, contentType, storageKey });
  } else {
    await db.insert(journalImages).values({ id, journalId, contentType, data });
  }
  return id;
}

export async function saveProfileImage(
  userId: string,
  contentType: string,
  data: Buffer
): Promise<string> {
  const id = newId();
  if (storageEnabled()) {
    const storageKey = `profile-images/${userId}/${id}`;
    await putObject(storageKey, data, contentType);
    await db
      .insert(profileImages)
      .values({ id, userId, contentType, storageKey });
  } else {
    await db.insert(profileImages).values({ id, userId, contentType, data });
  }
  return id;
}

/** One audio segment; returns the row values to insert (bytes already stored). */
export async function prepareAudioSegment(
  journalId: string,
  contentType: string,
  data: Buffer
): Promise<{
  id: string;
  contentType: string;
  data: Buffer | null;
  storageKey: string | null;
}> {
  const id = newId();
  if (storageEnabled()) {
    const storageKey = `audio/${journalId}/${id}`;
    await putObject(storageKey, data, contentType);
    return { id, contentType, data: null, storageKey };
  }
  return { id, contentType, data, storageKey: null };
}

// --- Serving ----------------------------------------------------------------

interface ServableMedia {
  contentType: string;
  data: Buffer | null;
  storageKey: string | null;
}

/**
 * Serve a media row: bucket rows 302 to a short-lived signed URL (the bucket
 * handles Range/bandwidth natively); legacy rows stream the Postgres bytes.
 */
export async function mediaResponse(
  media: ServableMedia,
  cacheControl: string
): Promise<Response> {
  if (media.storageKey && storageEnabled()) {
    const url = await presignGetUrl(media.storageKey, media.contentType);
    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        // Shorter than the presign lifetime so cached redirects stay valid.
        "Cache-Control": cacheControl.startsWith("public")
          ? "public, max-age=900"
          : "private, max-age=300",
      },
    });
  }
  if (!media.data) {
    return Response.json({ error: "Media unavailable" }, { status: 404 });
  }
  return new Response(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(media.data.length),
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
    },
  });
}

// --- Deleting ---------------------------------------------------------------

/** Delete journal-image rows and their bucket objects. */
export async function removeJournalImages(ids: (string | null)[]) {
  const real = ids.filter((x): x is string => !!x);
  if (real.length === 0) return;
  const removed = await db
    .delete(journalImages)
    .where(inArray(journalImages.id, real))
    .returning({ storageKey: journalImages.storageKey });
  await deleteObjects(removed.map((r) => r.storageKey));
}

/** Delete one profile-image row and its bucket object. */
export async function removeProfileImage(id: string | null) {
  if (!id) return;
  const removed = await db
    .delete(profileImages)
    .where(eq(profileImages.id, id))
    .returning({ storageKey: profileImages.storageKey });
  await deleteObjects(removed.map((r) => r.storageKey));
}

/**
 * Collect every bucket key a journal owns (audio + images), for deletion
 * AFTER the journal row cascade removes the DB rows.
 */
export async function journalStorageKeys(journalId: string): Promise<string[]> {
  const [audio, images] = await Promise.all([
    db
      .select({ storageKey: journalAudio.storageKey })
      .from(journalAudio)
      .where(eq(journalAudio.journalId, journalId)),
    db
      .select({ storageKey: journalImages.storageKey })
      .from(journalImages)
      .where(eq(journalImages.journalId, journalId)),
  ]);
  return [...audio, ...images]
    .map((r) => r.storageKey)
    .filter((k): k is string => !!k);
}

export { deleteObjects };
