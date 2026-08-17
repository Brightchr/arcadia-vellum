import { sessionFromRequest, jsonError } from "@/lib/api";
import { isAdmin, setWorkBanned, logAdminAction } from "@/lib/admin";
import { getJournalById } from "@/lib/journals";
import { isBanReason, banReasonLabel } from "@/lib/ban-reasons";

export const runtime = "nodejs";

/**
 * Admin-only: take a work down or restore it.
 * JSON: { journalId, banned, reason? } — reason is a code from
 * src/lib/ban-reasons.ts, shown to the owner on their banned work.
 */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session || !(await isAdmin(session.user.id))) {
    return jsonError("Not found", 404);
  }
  const body = (await request.json().catch(() => null)) as {
    journalId?: unknown;
    banned?: unknown;
    reason?: unknown;
  } | null;
  if (
    !body ||
    typeof body.journalId !== "string" ||
    typeof body.banned !== "boolean"
  ) {
    return jsonError("journalId and banned are required", 400);
  }
  const journal = await getJournalById(body.journalId);
  if (!journal) return jsonError("Work not found", 404);
  const reason = isBanReason(body.reason) ? body.reason : "other";

  await setWorkBanned(journal.id, body.banned, reason);
  await logAdminAction(
    session.user.id,
    body.banned ? "ban_work" : "unban_work",
    journal.ownerId,
    body.banned
      ? `"${journal.title}" — ${banReasonLabel(reason)}`
      : `"${journal.title}"`
  );
  return Response.json(
    { ok: true, banned: body.banned },
    { headers: { "Cache-Control": "no-store" } }
  );
}
