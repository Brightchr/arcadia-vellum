import { sessionFromRequest, jsonError } from "@/lib/api";
import { createJournal, deleteJournal } from "@/lib/journals";
import { ingestUpload } from "@/lib/content/ingest";
import { isThemeId } from "@/lib/themes";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";
import { findOrCreateSeries, nextVolumeNumber } from "@/lib/series";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Create a journal. Multipart form:
 *  - title (required), characterName?, theme?
 *  - sourceType: "upload" | "gdoc" | "audio" | "write"
 *  - file: the uploaded document (sourceType=upload)
 *  - gdocFileId: Google Doc file id (sourceType=gdoc; content synced separately)
 *  - sourceType=audio creates an audio-only tome; the client then uploads
 *    narration tracks via POST /api/journals/[id]/audio
 *  - sourceType=write creates an empty tome for the built-in editor; content
 *    is saved via PUT /api/journals/[id]/content
 */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const subtitle = String(form.get("subtitle") ?? "").trim() || null;
  const description =
    String(form.get("description") ?? "").trim().slice(0, 2000) || null;
  if (description && !isTextSafe(description)) {
    return jsonError(UNSAFE_TEXT_ERROR, 400);
  }
  const author = String(form.get("author") ?? "").trim() || null;
  const themeRaw = String(form.get("theme") ?? "");
  const sourceType = String(form.get("sourceType") ?? "");

  if (!title) return jsonError("Title is required", 400);
  if (title.length > 120) return jsonError("Title is too long", 400);
  if (
    sourceType !== "upload" &&
    sourceType !== "gdoc" &&
    sourceType !== "audio" &&
    sourceType !== "write"
  ) {
    return jsonError("Invalid source type", 400);
  }
  const theme = isThemeId(themeRaw) ? themeRaw : undefined;

  // Optional series membership: find-or-create by name, auto-number if the
  // volume number wasn't given.
  const seriesName = String(form.get("seriesName") ?? "").trim();
  const volumeRaw = parseInt(String(form.get("volumeNumber") ?? ""), 10);
  const partRaw = parseInt(String(form.get("partNumber") ?? ""), 10);
  let seriesId: string | null = null;
  let volumeNumber: number | null = null;
  let partNumber: number | null = null;
  if (seriesName) {
    const s = await findOrCreateSeries(session.user.id, seriesName);
    seriesId = s.id;
    volumeNumber =
      Number.isFinite(volumeRaw) && volumeRaw > 0
        ? volumeRaw
        : await nextVolumeNumber(s.id);
    partNumber = Number.isFinite(partRaw) && partRaw > 0 ? partRaw : null;
  }

  if (sourceType === "upload") {
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("A file is required", 400);
    if (file.size > MAX_UPLOAD_BYTES) {
      return jsonError("File too large (max 15 MB)", 400);
    }

    const journal = await createJournal({
      ownerId: session.user.id,
      title,
      subtitle,
      description,
      author,
      seriesId,
      volumeNumber,
      partNumber,
      theme,
      sourceType: "upload",
    });
    const result = await ingestUpload(
      journal.id,
      file.name,
      Buffer.from(await file.arrayBuffer())
    );
    if (!result.ok) {
      await deleteJournal(journal.id);
      return jsonError(result.error, 400);
    }
    return Response.json({ journal });
  }

  if (sourceType === "audio" || sourceType === "write") {
    const journal = await createJournal({
      ownerId: session.user.id,
      title,
      subtitle,
      description,
      author,
      seriesId,
      volumeNumber,
      partNumber,
      theme,
      sourceType,
    });
    return Response.json({ journal });
  }

  // sourceType === "gdoc": create the shell; the client then calls
  // POST /api/journals/[id]/sync to pull content from Drive.
  const gdocFileId = String(form.get("gdocFileId") ?? "").trim();
  if (!gdocFileId) return jsonError("Missing Google Doc id", 400);

  const journal = await createJournal({
    ownerId: session.user.id,
    title,
    subtitle,
    description,
    author,
    seriesId,
    volumeNumber,
    partNumber,
    theme,
    sourceType: "gdoc",
    gdocFileId,
  });
  return Response.json({ journal });
}
