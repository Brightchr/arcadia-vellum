import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  getOwnedPlaylist,
  updatePlaylist,
  deletePlaylist,
  reorderPlaylist,
  addPlaylistItem,
  removePlaylistItem,
} from "@/lib/playlists";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";

export const runtime = "nodejs";

async function owned(request: Request, id: string) {
  const session = await sessionFromRequest(request);
  if (!session) return { error: jsonError("Not signed in", 401) };
  const playlist = await getOwnedPlaylist(id, session.user.id);
  if (!playlist) return { error: jsonError("Playlist not found", 404) };
  return { session, playlist };
}

/**
 * Update a playlist. JSON any of:
 *  { name } rename · { icon } sidebar icon · { order: [journalId...] } reorder
 *  { add: journalId } append · { remove: journalId } drop
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await owned(request, id);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON body", 400);

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return jsonError("A name is required", 400);
    if (name.length > 80) return jsonError("Name is too long", 400);
    if (!isTextSafe(name)) return jsonError(UNSAFE_TEXT_ERROR, 400);
    await updatePlaylist(id, { name });
  }
  if (typeof body.icon === "string" || body.icon === null) {
    await updatePlaylist(id, {
      icon:
        typeof body.icon === "string"
          ? body.icon.trim().slice(0, 8) || null
          : null,
    });
  }
  if (Array.isArray(body.order)) {
    const order = (body.order as unknown[]).filter(
      (x): x is string => typeof x === "string"
    );
    await reorderPlaylist(id, order);
  }
  if (typeof body.add === "string") {
    await addPlaylistItem(id, body.add);
  }
  if (typeof body.remove === "string") {
    await removePlaylistItem(id, body.remove);
  }
  return Response.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await owned(request, id);
  if (error) return error;
  await deletePlaylist(id);
  return Response.json({ ok: true });
}
