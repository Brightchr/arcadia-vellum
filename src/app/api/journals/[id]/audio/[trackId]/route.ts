import { sessionFromRequest, jsonError } from "@/lib/api";
import { getOwnedJournal } from "@/lib/journals";
import { getTrack, deleteTrack } from "@/lib/audio";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; trackId: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id, trackId } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);
  const track = await getTrack(trackId);
  if (!track || track.journalId !== id) return jsonError("Track not found", 404);

  await deleteTrack(trackId);
  return Response.json({ ok: true });
}
