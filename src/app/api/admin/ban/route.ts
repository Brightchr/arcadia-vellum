import { sessionFromRequest, jsonError } from "@/lib/api";
import { isAdmin, setUserBanned, logAdminAction } from "@/lib/admin";
import { getUserById } from "@/lib/profile";

export const runtime = "nodejs";

/**
 * Admin-only: ban or unban an account. JSON: { userId, banned }.
 * Banning hides the user's works/reviews/profile and notifies everyone
 * who saved their work; unbanning restores visibility.
 */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session || !(await isAdmin(session.user.id))) {
    return jsonError("Not found", 404);
  }
  const body = (await request.json().catch(() => null)) as {
    userId?: unknown;
    banned?: unknown;
  } | null;
  if (!body || typeof body.userId !== "string" || typeof body.banned !== "boolean") {
    return jsonError("userId and banned are required", 400);
  }
  if (body.userId === session.user.id) {
    return jsonError("You can't ban yourself", 400);
  }
  const target = await getUserById(body.userId);
  if (!target) return jsonError("User not found", 404);
  if (target.role === "admin") {
    return jsonError("Admins can't be banned", 400);
  }
  await setUserBanned(target.id, body.banned);
  // Every moderation action is recorded permanently.
  await logAdminAction(
    session.user.id,
    body.banned ? "ban" : "unban",
    target.id,
    `${target.name}${target.username ? ` (@${target.username})` : ""}`
  );
  return Response.json(
    { ok: true, banned: body.banned },
    { headers: { "Cache-Control": "no-store" } }
  );
}
