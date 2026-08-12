import { db } from "@/db";
import { userDislikes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function parseBody(
  body: unknown
): { kind: "journal" | "series"; itemId: string } | null {
  const b = body as { kind?: unknown; itemId?: unknown } | null;
  const kind: "journal" | "series" | null =
    b?.kind === "series" ? "series" : b?.kind === "journal" ? "journal" : null;
  const itemId = typeof b?.itemId === "string" ? b.itemId : null;
  return kind && itemId ? { kind, itemId } : null;
}

/** Mark a work Not Interested — hides it from browse and the home feed. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "dislikes", {
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return jsonError("kind and itemId are required", 400);
  await db
    .insert(userDislikes)
    .values({ userId: session.user.id, ...parsed })
    .onConflictDoNothing();
  return Response.json({ ok: true });
}

/** Undo Not Interested. */
export async function DELETE(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const parsed = parseBody(await request.json().catch(() => null));
  if (!parsed) return jsonError("kind and itemId are required", 400);
  await db
    .delete(userDislikes)
    .where(
      and(
        eq(userDislikes.userId, session.user.id),
        eq(userDislikes.kind, parsed.kind),
        eq(userDislikes.itemId, parsed.itemId)
      )
    );
  return Response.json({ ok: true });
}
