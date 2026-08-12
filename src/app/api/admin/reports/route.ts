import { sessionFromRequest, jsonError } from "@/lib/api";
import { isAdmin, logAdminAction, setUserBanned } from "@/lib/admin";
import { resolveReport } from "@/lib/reports";

export const runtime = "nodejs";

/**
 * Resolve a report. JSON: {id, outcome: "dismissed" | "upheld", ban?: true}.
 * Dismissing lifts the reported user's mute; upholding may also platform-ban.
 */
export async function PATCH(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  if (!(await isAdmin(session.user.id))) return jsonError("Admins only", 403);

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    outcome?: unknown;
    ban?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : null;
  const outcome =
    body?.outcome === "dismissed" || body?.outcome === "upheld"
      ? body.outcome
      : null;
  if (!id || !outcome) return jsonError("id and outcome are required", 400);

  const resolved = await resolveReport(id, session.user.id, outcome);
  if (!resolved) return jsonError("Report not found or already resolved", 404);

  await logAdminAction(
    session.user.id,
    `report_${outcome}`,
    resolved.userId,
    `report ${id}`
  );
  if (outcome === "upheld" && body?.ban === true) {
    await setUserBanned(resolved.userId, true);
    await logAdminAction(session.user.id, "ban", resolved.userId, `report ${id}`);
  }
  return Response.json({ ok: true });
}
