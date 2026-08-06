import { sessionFromRequest, jsonError } from "@/lib/api";
import { createPlaylist } from "@/lib/playlists";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";

export const runtime = "nodejs";

/** Create a playlist. JSON: { name } */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("A name is required", 400);
  if (name.length > 80) return jsonError("Name is too long", 400);
  if (!isTextSafe(name)) return jsonError(UNSAFE_TEXT_ERROR, 400);
  const playlist = await createPlaylist(session.user.id, name);
  return Response.json({ playlist });
}
