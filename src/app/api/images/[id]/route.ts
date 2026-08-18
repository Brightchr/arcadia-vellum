import { db } from "@/db";
import { journalImages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { getJournalById } from "@/lib/journals";
import { canAccessJournal, isDiscoverable } from "@/lib/access";
import { mediaResponse } from "@/lib/media";

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

  // Cover images double as browse/teaser art for SIGNED-IN readers; without
  // a session, only a share grant serves anything (no anonymous media).
  const session = await sessionFromRequest(request);
  if (!session || journal.bannedAt || !isDiscoverable(journal.visibility)) {
    if (!(await canAccessJournal(session?.user.id ?? null, journal))) {
      return jsonError("Not found", 404);
    }
  }

  return mediaResponse(image, "private, max-age=300");
}
