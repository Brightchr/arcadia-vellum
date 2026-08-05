import { sessionFromRequest, jsonError } from "@/lib/api";
import { getOwnedJournal } from "@/lib/journals";
import { saveWrittenContent } from "@/lib/content/ingest";

export const runtime = "nodejs";

const MAX_MARKDOWN_CHARS = 2 * 1024 * 1024;

/** Save editor content (owner). JSON body: { markdown } */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);
  if (journal.sourceType !== "write") {
    return jsonError("Only written-here tomes are editable", 400);
  }

  const body = await request.json().catch(() => null);
  const markdown = typeof body?.markdown === "string" ? body.markdown : null;
  if (markdown === null) return jsonError("Missing markdown", 400);
  if (markdown.length > MAX_MARKDOWN_CHARS) {
    return jsonError("Content too large (max 2 MB)", 400);
  }

  await saveWrittenContent(id, markdown);
  return Response.json({ ok: true });
}
