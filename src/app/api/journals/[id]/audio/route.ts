import { sessionFromRequest, jsonError } from "@/lib/api";
import { getOwnedJournal } from "@/lib/journals";
import { addTrack, AUDIO_TYPES, MAX_AUDIO_BYTES } from "@/lib/audio";

export const runtime = "nodejs";

/** Upload narration tracks (owner). Multipart field: files (one or many). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return jsonError("No audio files provided", 400);

  const added = [];
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
      return jsonError(`"${file.name}" is over the 40 MB limit`, 400);
    }
    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Track";
    added.push(
      await addTrack(id, title, contentType, Buffer.from(await file.arrayBuffer()))
    );
  }
  return Response.json({ tracks: added });
}
