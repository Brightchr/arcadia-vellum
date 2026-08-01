import { db } from "@/db";
import { journalImages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { getJournalById } from "@/lib/journals";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(journalImages)
    .where(eq(journalImages.id, id));
  const image = rows[0];
  if (!image) return jsonError("Not found", 404);

  const journal = await getJournalById(image.journalId);
  if (!journal) return jsonError("Not found", 404);

  if (journal.visibility !== "public") {
    const session = await sessionFromRequest(request);
    if (!session || session.user.id !== journal.ownerId) {
      return jsonError("Not found", 404);
    }
  }

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control":
        journal.visibility === "public"
          ? "public, max-age=3600"
          : "private, max-age=300",
    },
  });
}
