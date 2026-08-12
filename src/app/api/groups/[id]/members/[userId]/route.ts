import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  assignRank,
  banMember,
  canModerate,
  getGroup,
  kickMember,
  memberRole,
  setMemberRole,
} from "@/lib/groups";
import { createReport, isReportReason } from "@/lib/reports";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Who may act on whom: owners moderate everyone below them; admins moderate
 * plain members only. Nobody acts on themselves or the owner.
 */
async function moderationGuard(
  request: Request,
  params: Promise<{ id: string; userId: string }>
) {
  const session = await sessionFromRequest(request);
  if (!session) return { error: jsonError("Not signed in", 401) };
  const { id, userId } = await params;
  if (userId === session.user.id) {
    return { error: jsonError("You can't moderate yourself", 400) };
  }
  const group = await getGroup(id);
  if (!group) return { error: jsonError("Group not found", 404) };
  const actorRole = await memberRole(id, session.user.id);
  if (!canModerate(actorRole)) {
    return { error: jsonError("Only the owner and admins can do that", 403) };
  }
  const targetRole = await memberRole(id, userId);
  if (!targetRole) return { error: jsonError("Not a member", 404) };
  if (targetRole === "owner") {
    return { error: jsonError("The owner can't be moderated", 400) };
  }
  if (actorRole === "admin" && targetRole === "admin") {
    return { error: jsonError("Only the owner can moderate admins", 403) };
  }
  return { session, groupId: id, targetId: userId, actorRole };
}

/**
 * Change a member: {role} (owner only: admin|member) and/or {rankId}
 * (owner/admin: a rank id, or null to clear).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const g = await moderationGuard(request, params);
  if ("error" in g) return g.error;
  const body = (await request.json().catch(() => null)) as {
    role?: unknown;
    rankId?: unknown;
  } | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  let changed = false;
  if (body.role !== undefined) {
    if (g.actorRole !== "owner") {
      return jsonError("Only the owner can change roles", 403);
    }
    if (body.role !== "admin" && body.role !== "member") {
      return jsonError("role must be admin or member", 400);
    }
    const res = await setMemberRole(g.groupId, g.targetId, body.role);
    if (!res.ok) return jsonError(res.error ?? "Could not change role", 400);
    changed = true;
  }
  if (body.rankId !== undefined) {
    if (typeof body.rankId !== "string" && body.rankId !== null) {
      return jsonError("rankId must be a string or null", 400);
    }
    const res = await assignRank(g.groupId, g.targetId, body.rankId);
    if (!res.ok) return jsonError(res.error ?? "Could not assign rank", 400);
    changed = true;
  }
  if (!changed) return jsonError("Nothing to update", 400);
  return Response.json({ ok: true });
}

/** Kick (remove without banning). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const g = await moderationGuard(request, params);
  if ("error" in g) return g.error;
  const res = await kickMember(g.groupId, g.targetId);
  if (!res.ok) return jsonError(res.error ?? "Could not remove", 400);
  return Response.json({ ok: true });
}

/**
 * Ban from the group, optionally escalating to Vellum moderators.
 * JSON: {action: "ban", report?: {reason, details}}.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const limited = rateLimit(request, "group-ban", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const g = await moderationGuard(request, params);
  if ("error" in g) return g.error;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    report?: { reason?: unknown; details?: unknown };
  } | null;
  if (body?.action !== "ban") return jsonError("Unknown action", 400);

  const res = await banMember(g.groupId, g.targetId, g.session.user.id);
  if (!res.ok) return jsonError(res.error ?? "Could not ban", 400);

  let reported = false;
  if (body.report && isReportReason(body.report.reason)) {
    const details =
      typeof body.report.details === "string"
        ? body.report.details.trim().slice(0, 500) || null
        : null;
    await createReport({
      userId: g.targetId,
      reportedBy: g.session.user.id,
      groupId: g.groupId,
      reason: body.report.reason,
      details,
    });
    reported = true;
  }
  return Response.json({ ok: true, reported });
}
