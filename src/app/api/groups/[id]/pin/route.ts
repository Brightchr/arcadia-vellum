import { sessionFromRequest, jsonError } from "@/lib/api";
import { memberRole, setGroupPinned } from "@/lib/groups";

export const runtime = "nodejs";

/** Pin/unpin this group on the caller's social rail. JSON: {pinned}. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  if (!(await memberRole(id, session.user.id))) {
    return jsonError("Members only", 403);
  }
  const body = (await request.json().catch(() => null)) as {
    pinned?: unknown;
  } | null;
  if (typeof body?.pinned !== "boolean") {
    return jsonError("pinned must be true or false", 400);
  }
  await setGroupPinned(id, session.user.id, body.pinned);
  return Response.json({ ok: true });
}
