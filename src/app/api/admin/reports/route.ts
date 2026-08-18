import { sessionFromRequest, jsonError } from "@/lib/api";
import { isAdmin, logAdminAction, setUserBanned } from "@/lib/admin";
import { resolveReport } from "@/lib/reports";
import { getUserById } from "@/lib/profile";
import { banReasonLabel } from "@/lib/ban-reasons";

export const runtime = "nodejs";

/**
 * Resolve a report. JSON: {id, outcome: "dismissed" | "upheld", ban?: true}.
 * Dismissing lifts the reported user's mute; upholding may also platform-ban.
 */
export async function PATCH(request: Request) {
  const session = await sessionFromRequest(request);
  // Opaque 404 like the other admin routes — don't advertise the endpoint.
  if (!session || !(await isAdmin(session.user.id))) {
    return jsonError("Not found", 404);
  }

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
    // Same guards as /api/admin/ban — this path must not become a bypass.
    const target = await getUserById(resolved.userId);
    if (!target || target.role === "admin" || target.id === session.user.id) {
      return jsonError("This account can't be banned", 400);
    }
    const reason = "guidelines";
    await setUserBanned(target.id, true, { reason });
    await logAdminAction(
      session.user.id,
      "ban",
      target.id,
      `report ${id} — ${banReasonLabel(reason)}, permanent`
    );
  }
  return Response.json({ ok: true });
}
