import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  getOwnedSeries,
  findSeriesByName,
  renameSeries,
} from "@/lib/series";

export const runtime = "nodejs";

/** Rename a collection (owner). JSON body: { name } */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const s = await getOwnedSeries(id, session.user.id);
  if (!s) return jsonError("Collection not found", 404);

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return jsonError("A name is required", 400);
  if (name.length > 80) return jsonError("Name is too long", 400);

  const clash = await findSeriesByName(session.user.id, name, id);
  if (clash) {
    return jsonError("You already have a collection with that name", 400);
  }

  const updated = await renameSeries(id, name);
  return Response.json({ series: updated });
}
