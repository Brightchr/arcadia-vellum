import { sessionFromRequest, jsonError } from "@/lib/api";
import { getJournalById } from "@/lib/journals";
import { getTrack } from "@/lib/audio";
import { canAccessJournal } from "@/lib/access";
import { isUserBanned } from "@/lib/profile";

export const runtime = "nodejs";

/** Streams a narration track with Range support so players can seek. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const track = await getTrack(id);
  if (!track) return jsonError("Not found", 404);

  const journal = await getJournalById(track.journalId);
  if (!journal) return jsonError("Not found", 404);
  const openToAll = journal.visibility === "public" && journal.listed;
  if (!openToAll || (await isUserBanned(journal.ownerId))) {
    const session = await sessionFromRequest(request);
    if (!(await canAccessJournal(session?.user.id ?? null, journal))) {
      return jsonError("Not found", 404);
    }
  }

  const data = track.data;
  const total = data.length;
  const cacheControl = openToAll
    ? "public, max-age=3600"
    : "private, max-age=300";

  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (match && (match[1] || match[2])) {
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
    if (start >= total || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: {
        "Content-Type": track.contentType,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": cacheControl,
      },
    });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": track.contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
    },
  });
}
