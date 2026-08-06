import { sessionFromRequest, jsonError } from "@/lib/api";
import { getOwnedJournal } from "@/lib/journals";
import { cleanTagNames, setJournalTags } from "@/lib/tags";

export const runtime = "nodejs";

/** Replace a journal's tags (owner). JSON: {tags: string[]} */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);

  const body = (await request.json().catch(() => null)) as {
    tags?: unknown;
  } | null;
  if (!Array.isArray(body?.tags) || body.tags.some((t) => typeof t !== "string")) {
    return jsonError("tags must be an array of strings", 400);
  }
  const cleaned = cleanTagNames(body.tags as string[]);
  if (!cleaned.ok) return jsonError(cleaned.error, 400);

  await setJournalTags(id, cleaned.names);
  return Response.json({ tags: cleaned.names });
}
