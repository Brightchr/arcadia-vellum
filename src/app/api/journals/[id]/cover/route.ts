import { db } from "@/db";
import { journals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError, bodyTooLarge } from "@/lib/api";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";
import { getOwnedJournal } from "@/lib/journals";
import { storeImage } from "@/lib/content/images";
import { removeJournalImages } from "@/lib/media";

export const runtime = "nodejs";

const MAX_COVER_BYTES = 5 * 1024 * 1024;

async function dropCover(coverImageId: string | null) {
  await removeJournalImages([coverImageId]);
}

/** Set the cover image (owner). Multipart field: file */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request, "cover-upload", {
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const userLimited = rateLimitUser(session.user.id, "cover-upload", {
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (userLimited) return userLimited;
  const tooLarge = bodyTooLarge(request, MAX_COVER_BYTES + 64 * 1024);
  if (tooLarge) return tooLarge;
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);

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
