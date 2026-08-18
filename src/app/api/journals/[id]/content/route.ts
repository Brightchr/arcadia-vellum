import { sessionFromRequest, jsonError } from "@/lib/api";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";
import { getOwnedJournal } from "@/lib/journals";
import { saveWrittenContent } from "@/lib/content/ingest";

export const runtime = "nodejs";

const MAX_MARKDOWN_CHARS = 2 * 1024 * 1024;

/** Save editor content (owner). JSON body: { markdown } */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Each save can trigger up to 50 outbound image fetches (localizeImages) —
  // without a limit this route is a server-side fetch amplifier.
  const limited = rateLimit(request, "content-save", {
    limit: 30,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const userLimited = rateLimitUser(session.user.id, "content-save", {
    limit: 60,
    windowMs: 60 * 60_000,
  });
  if (userLimited) return userLimited;
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
