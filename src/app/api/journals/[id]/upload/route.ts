import { sessionFromRequest, jsonError, bodyTooLarge } from "@/lib/api";
import { getOwnedJournal } from "@/lib/journals";
import { ingestUpload } from "@/lib/content/ingest";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Replace a journal's content with a newly uploaded file. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request, "journal-upload", {
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const userLimited = rateLimitUser(session.user.id, "journal-upload", {
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (userLimited) return userLimited;
  const tooLarge = bodyTooLarge(request, MAX_UPLOAD_BYTES + 64 * 1024);
  if (tooLarge) return tooLarge;
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("A file is required", 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("File too large (max 15 MB)", 400);
  }

  const result = await ingestUpload(
    id,
    file.name,
    Buffer.from(await file.arrayBuffer())
  );
  if (!result.ok) return jsonError(result.error, 400);
  return Response.json({ ok: true });
}
