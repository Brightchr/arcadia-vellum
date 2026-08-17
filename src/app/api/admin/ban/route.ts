import { sessionFromRequest, jsonError } from "@/lib/api";
import { isAdmin, setUserBanned, logAdminAction } from "@/lib/admin";
import { getUserById } from "@/lib/profile";
import { banKnownIpsForUser, liftIpBansForUser } from "@/lib/bans";
import { isBanReason, banReasonLabel } from "@/lib/ban-reasons";

export const runtime = "nodejs";

// Suspension durations the admin UI offers, in days. null = permanent.
const ALLOWED_DAYS = new Set([1, 7, 30]);

/**
 * Admin-only: ban or unban an account.
 * JSON: { userId, banned, reason?, days?, banIps? }
 *  - reason: a code from src/lib/ban-reasons.ts (shown to the user at sign-in)
 *  - days: 1 | 7 | 30 for a suspension; omitted = permanent
 *  - banIps: also ban every IP the account's sessions were created from
 * Banning hides the user's works/reviews/profile, signs them out everywhere,
 * and notifies everyone who saved their work; unbanning restores visibility
 * and lifts any IP bans tied to the account.
 */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session || !(await isAdmin(session.user.id))) {
    return jsonError("Not found", 404);
  }
  const body = (await request.json().catch(() => null)) as {
    userId?: unknown;
    banned?: unknown;
    reason?: unknown;
    days?: unknown;
    banIps?: unknown;
  } | null;
  if (!body || typeof body.userId !== "string" || typeof body.banned !== "boolean") {
    return jsonError("userId and banned are required", 400);
  }
  if (body.userId === session.user.id) {
    return jsonError("You can't ban yourself", 400);
  }
  const reason = isBanReason(body.reason) ? body.reason : "other";
  const days =
    typeof body.days === "number" && ALLOWED_DAYS.has(body.days)
      ? body.days
      : null;
  const banIps = body.banIps === true;
  const target = await getUserById(body.userId);
  if (!target) return jsonError("User not found", 404);
  if (target.role === "admin") {
    return jsonError("Admins can't be banned", 400);
  }

  await setUserBanned(target.id, body.banned, { reason, days });
  let ipCount = 0;
  if (body.banned && banIps) {
    ipCount = await banKnownIpsForUser(
      target.id,
      reason,
      session.user.id,
      days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null
    );
  }
  if (!body.banned) {
    await liftIpBansForUser(target.id);
  }

  // Every moderation action is recorded permanently.
  const who = `${target.name}${target.username ? ` (@${target.username})` : ""}`;
  await logAdminAction(
    session.user.id,
    body.banned ? "ban" : "unban",
    target.id,
    body.banned
      ? `${who} — ${banReasonLabel(reason)}${days ? `, ${days}d` : ", permanent"}${ipCount > 0 ? `, ${ipCount} IP(s) banned` : ""}`
      : who
  );
  return Response.json(
    { ok: true, banned: body.banned },
    { headers: { "Cache-Control": "no-store" } }
  );
}
