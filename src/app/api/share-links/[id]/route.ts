import { sessionFromRequest, jsonError } from "@/lib/api";
import { revokeShareLink } from "@/lib/share";

export const runtime = "nodejs";

/** Revoke a share link — everyone who redeemed it loses access at once. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const removed = await revokeShareLink(session.user.id, id);
  if (!removed) return jsonError("Not found", 404);
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
