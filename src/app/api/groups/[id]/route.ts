import { db } from "@/db";
import { groups } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  getGroup,
  joinGroup,
  leaveGroup,
  memberRole,
} from "@/lib/groups";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";
import { rateLimitUser } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Join (action: "join") or leave (action: "leave") a group. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
  } | null;

  if (body?.action === "leave") {
    const res = await leaveGroup(id, session.user.id);
    if (!res.ok) return jsonError(res.error ?? "Could not leave", 400);
    return Response.json({ ok: true });
  }
  // Bot-spam brake: an account can't mass-join groups.
  const limited = rateLimitUser(session.user.id, "group-join", {
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (limited) return limited;
  const res = await joinGroup(id, session.user.id);
  if (!res.ok) return jsonError(res.error ?? "Could not join", 403);
  return Response.json({ ok: true });
}

/** Owner-only: rename, re-describe, re-icon, or change visibility. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const role = await memberRole(id, session.user.id);
  if (role !== "owner") return jsonError("Only the owner can edit the group", 403);

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  const patch: Partial<typeof groups.$inferInsert> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 60);
    if (!name) return jsonError("Give the group a name", 400);
    if (!isTextSafe(name)) return jsonError(UNSAFE_TEXT_ERROR, 400);
    patch.name = name;
  }
  if (typeof body.description === "string") {
    const description = body.description.trim().slice(0, 300);
    if (description && !isTextSafe(description)) {
      return jsonError(UNSAFE_TEXT_ERROR, 400);
    }
    patch.description = description || null;
  }
  if (typeof body.icon === "string") {
    patch.icon = body.icon.trim().slice(0, 8) || null;
  }
  if (body.visibility === "public" || body.visibility === "private") {
    patch.visibility = body.visibility;
  }
  if (typeof body.welcomeMessage === "string") {
    const welcome = body.welcomeMessage.trim().slice(0, 500);
    if (welcome && !isTextSafe(welcome)) {
      return jsonError(UNSAFE_TEXT_ERROR, 400);
    }
    patch.welcomeMessage = welcome || null;
  }
  if (Object.keys(patch).length === 0) return jsonError("Nothing to update", 400);

  await db.update(groups).set(patch).where(eq(groups.id, id));
  return Response.json({ ok: true });
}

/** Owner-only: delete the group (channels, messages, members cascade). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) return jsonError("Group not found", 404);
  if (group.ownerId !== session.user.id) {
    return jsonError("Only the owner can delete the group", 403);
  }
  await db.delete(groups).where(eq(groups.id, id));
  return Response.json({ ok: true });
}
