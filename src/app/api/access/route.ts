import { db } from "@/db";
import { journals, series } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { requestAccess, setGrant } from "@/lib/access";
import { notify } from "@/lib/notifications";

export const runtime = "nodejs";

type Kind = "journal" | "series";

function parseKind(v: unknown): Kind | null {
  return v === "journal" || v === "series" ? v : null;
}

async function workOwner(kind: Kind, itemId: string): Promise<string | null> {
  if (kind === "journal") {
    const rows = await db
      .select({ ownerId: journals.ownerId })
      .from(journals)
      .where(eq(journals.id, itemId));
    return rows[0]?.ownerId ?? null;
  }
  const rows = await db
    .select({ ownerId: series.ownerId })
    .from(series)
    .where(eq(series.id, itemId));
  return rows[0]?.ownerId ?? null;
}

/** Ask for access to a restricted work. JSON: { kind, itemId } */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const body = await request.json().catch(() => null);
  const kind = parseKind(body?.kind);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!kind || !itemId) return jsonError("kind and itemId are required", 400);

  const ownerId = await workOwner(kind, itemId);
  if (!ownerId) return jsonError("Work not found", 404);
  if (ownerId === session.user.id) return jsonError("That's your work", 400);

  await requestAccess(session.user.id, kind, itemId);
  await notify(ownerId, "access_request", {
    actorId: session.user.id,
    kind,
    itemId,
  });
  return Response.json({ ok: true });
}

/**
 * Owner decision. JSON: { kind, itemId, userId, action: "grant" | "revoke" }
 * ("revoke" also declines a pending request.)
 */
export async function PATCH(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const body = await request.json().catch(() => null);
  const kind = parseKind(body?.kind);
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const action = body?.action === "grant" ? "grant" : body?.action === "revoke" ? "revoke" : null;
  if (!kind || !itemId || !userId || !action) {
    return jsonError("kind, itemId, userId, and action are required", 400);
  }

  const ownerId = await workOwner(kind, itemId);
  if (!ownerId) return jsonError("Work not found", 404);
  if (ownerId !== session.user.id) return jsonError("Not your work", 403);

  await setGrant(kind, itemId, userId, action === "grant");
  if (action === "grant") {
    await notify(userId, "access_granted", {
      actorId: session.user.id,
      kind,
      itemId,
    });
  }
  return Response.json({ ok: true });
}
