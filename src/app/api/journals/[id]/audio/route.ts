import { sessionFromRequest, jsonError, bodyTooLarge } from "@/lib/api";
import { getOwnedJournal } from "@/lib/journals";
import { addEntry, AUDIO_TYPES, MAX_AUDIO_BYTES, MAX_AUDIO_MB } from "@/lib/audio";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";
import { sniffAudioType } from "@/lib/sniff";

export const runtime = "nodejs";

// Whole-request ceiling: everything below it sits in memory at once.
const MAX_FILES_PER_REQUEST = 10;
const MAX_REQUEST_BYTES = 200 * 1024 * 1024;

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
  const limited = rateLimit(request, "audio-upload", {
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const userLimited = rateLimitUser(session.user.id, "audio-upload", {
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (userLimited) return userLimited;
  const tooLarge = bodyTooLarge(request, MAX_REQUEST_BYTES);
  if (tooLarge) return tooLarge;
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);
  if (journal.sourceType !== "audio") {
    return jsonError("Only audio-only tomes hold narration tracks", 400);
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return jsonError("No audio files provided", 400);
  if (files.length > MAX_FILES_PER_REQUEST) {
    return jsonError(
      `Upload at most ${MAX_FILES_PER_REQUEST} files at a time`,
      400
    );
  }
  const combine = String(form.get("combine") ?? "") === "true";
  const entryTitle = String(form.get("entryTitle") ?? "").trim();

  const prepared = [];
  for (const file of files) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!AUDIO_TYPES[ext]) {
      return jsonError(
        `Unsupported audio type "${ext}". Use .mp3, .m4a, .ogg, or .wav.`,
        400
      );
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return jsonError(`"${file.name}" is over the ${MAX_AUDIO_MB} MB limit`, 400);
    }
    const data = Buffer.from(await file.arrayBuffer());
    // The stored type comes from the bytes, not the filename — it's served
    // back verbatim from a public URL.
    const contentType = sniffAudioType(data);
    if (!contentType) {
      return jsonError(
        `"${file.name}" doesn't look like audio. Use .mp3, .m4a, .ogg, or .wav.`,
        400
      );
    }
    prepared.push({
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Track",
      contentType,
      data,
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
