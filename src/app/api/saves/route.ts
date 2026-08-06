import { sessionFromRequest, jsonError } from "@/lib/api";
import { isWorkPublic } from "@/lib/discovery";
import { saveItem, unsaveItem } from "@/lib/saves";

export const runtime = "nodejs";

function parseBody(
  body: unknown
): { kind: "journal" | "series"; itemId: string } | null {
  const b = body as { kind?: unknown; itemId?: unknown } | null;
  const kind =
    b?.kind === "series" ? ("series" as const) : b?.kind === "journal" ? ("journal" as const) : null;
  const itemId = typeof b?.itemId === "string" ? b.itemId : null;
  return kind && itemId ? { kind, itemId } : null;
}

export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return jsonError("kind and itemId are required", 400);
  const { ok } = await isWorkPublic(parsed.kind, parsed.itemId);
  if (!ok) return jsonError("Work not found", 404);
  await saveItem(session.user.id, parsed.kind, parsed.itemId);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return jsonError("kind and itemId are required", 400);
  await unsaveItem(session.user.id, parsed.kind, parsed.itemId);
  return Response.json({ ok: true });
}
