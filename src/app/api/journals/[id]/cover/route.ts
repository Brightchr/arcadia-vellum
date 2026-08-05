import { db } from "@/db";
import { journalImages, journals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { getOwnedJournal } from "@/lib/journals";
import { storeImage } from "@/lib/content/images";

export const runtime = "nodejs";

async function dropCover(coverImageId: string | null) {
  if (coverImageId) {
    await db.delete(journalImages).where(eq(journalImages.id, coverImageId));
  }
}

/** Set the cover image (owner). Multipart field: file */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);
  // Covers back the listening pages; content ingestion for written tomes
  // clears journal_images wholesale, so only audiobooks carry one.
  if (journal.sourceType !== "audio") {
    return jsonError("Only audiobooks carry a cover image", 400);
  }

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

  await dropCover(journal.coverImageId);
  await db.update(journals).set({ coverImageId }).where(eq(journals.id, id));
  return Response.json({ coverUrl: src });
}

/** Remove the cover image (owner). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);

  await dropCover(journal.coverImageId);
  await db
    .update(journals)
    .set({ coverImageId: null })
    .where(eq(journals.id, id));
  return Response.json({ ok: true });
}
