import { sessionFromRequest, jsonError } from "@/lib/api";
import { getOwnedJournal } from "@/lib/journals";
import { addEntry, AUDIO_TYPES, MAX_AUDIO_BYTES, MAX_AUDIO_MB } from "@/lib/audio";

export const runtime = "nodejs";

/**
 * Upload narration audio (owner). Multipart fields:
 *  - files: one or many audio files
 *  - combine: "true" to make ALL files the segments of ONE entry (played
 *    back-to-back as a single chapter); otherwise each file is its own entry
 *  - entryTitle: optional title for the combined entry
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);
  if (journal.sourceType !== "audio") {
    return jsonError("Only audio-only tomes hold narration tracks", 400);
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return jsonError("No audio files provided", 400);
  const combine = String(form.get("combine") ?? "") === "true";
  const entryTitle = String(form.get("entryTitle") ?? "").trim();

  const prepared = [];
  for (const file of files) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const contentType = AUDIO_TYPES[ext];
    if (!contentType) {
      return jsonError(
        `Unsupported audio type "${ext}". Use .mp3, .m4a, .ogg, or .wav.`,
        400
      );
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return jsonError(`"${file.name}" is over the ${MAX_AUDIO_MB} MB limit`, 400);
    }
    prepared.push({
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Track",
      contentType,
      data: Buffer.from(await file.arrayBuffer()),
    });
  }

  const added = [];
  if (combine && prepared.length > 1) {
    added.push(
      await addEntry(
        id,
        entryTitle || prepared[0].title,
        prepared.map(({ contentType, data }) => ({ contentType, data }))
      )
    );
  } else {
    for (const file of prepared) {
      added.push(
        await addEntry(id, entryTitle || file.title, [
          { contentType: file.contentType, data: file.data },
        ])
      );
    }
  }
  return Response.json({ tracks: added });
}
