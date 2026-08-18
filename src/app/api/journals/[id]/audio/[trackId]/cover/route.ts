import { db } from "@/db";
import { journalAudio } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError, bodyTooLarge } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getOwnedJournal } from "@/lib/journals";
import { getTrack } from "@/lib/audio";
import { storeImage } from "@/lib/content/images";
import { removeJournalImages } from "@/lib/media";

export const runtime = "nodejs";

const MAX_COVER_BYTES = 5 * 1024 * 1024;

async function ownedTrack(request: Request, id: string, trackId: string) {
  const session = await sessionFromRequest(request);
  if (!session) return { error: jsonError("Not signed in", 401) };
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return { error: jsonError("Journal not found", 404) };
  const track = await getTrack(trackId);
  if (!track || track.journalId !== id) {
    return { error: jsonError("Track not found", 404) };
  }
  return { track };
}

async function dropImage(coverImageId: string | null) {
  await removeJournalImages([coverImageId]);
}

/** Set a chapter image on an entry (owner). Multipart field: file */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; trackId: string }> }
) {
  const limited = rateLimit(request, "cover-upload", {
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;
  const tooLarge = bodyTooLarge(request, MAX_COVER_BYTES + 64 * 1024);
  if (tooLarge) return tooLarge;
  const { id, trackId } = await params;
  const { track, error } = await ownedTrack(request, id, trackId);
  if (!track) return error;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("An image is required", 400);

  const src = await storeImage(
    id,
    file.type,
    Buffer.from(await file.arrayBuffer())
  );
  if (!src) {
    return jsonError("Use a .png, .jpg, .gif, or .webp under 5 MB", 400);
  }
  const coverImageId = src.split("/").pop()!;

  await dropImage(track.coverImageId);
  await db
    .update(journalAudio)
    .set({ coverImageId })
    .where(eq(journalAudio.id, track.id));
  return Response.json({ coverUrl: src });
}

/** Remove an entry's chapter image (owner). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; trackId: string }> }
) {
  const { id, trackId } = await params;
  const { track, error } = await ownedTrack(request, id, trackId);
  if (!track) return error;

  await dropImage(track.coverImageId);
  await db
    .update(journalAudio)
    .set({ coverImageId: null })
    .where(eq(journalAudio.id, track.id));
  return Response.json({ ok: true });
}
