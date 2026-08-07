import { sessionFromRequest, jsonError } from "@/lib/api";
import { isWorkPublic, seriesVolumes } from "@/lib/discovery";
import { getJournalById } from "@/lib/journals";
import { canAccessJournal, accessibleJournalIds } from "@/lib/access";
import { upsertReview, deleteReview } from "@/lib/reviews";
import { notify } from "@/lib/notifications";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Create or update the caller's review. JSON: {kind, itemId, rating, body} */
export async function PUT(request: Request) {
  const limited = rateLimit(request, "reviews", {
    limit: 15,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    itemId?: unknown;
    rating?: unknown;
    body?: unknown;
  } | null;
  const kind =
    body?.kind === "series" ? "series" : body?.kind === "journal" ? "journal" : null;
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  const rating = Number(body?.rating);
  if (!kind || !itemId) return jsonError("kind and itemId are required", 400);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return jsonError("Rating must be 1-5", 400);
  }
  const text =
    typeof body?.body === "string" ? body.body.trim().slice(0, 2000) : "";
  if (text && !isTextSafe(text)) return jsonError(UNSAFE_TEXT_ERROR, 400);

  const { ok, ownerId } = await isWorkPublic(kind, itemId);
  if (!ok) return jsonError("Work not found", 404);
  if (ownerId === session.user.id) {
    return jsonError("You can't review your own work", 400);
  }

  // You can only review what you can actually open.
  const allowed =
    kind === "journal"
      ? await (async () => {
          const j = await getJournalById(itemId);
          return j ? canAccessJournal(session.user.id, j) : false;
        })()
      : await (async () => {
          const vols = await seriesVolumes(itemId, false);
          const accessible = await accessibleJournalIds(session.user.id, vols);
          return accessible.size > 0;
        })();
  if (!allowed) {
    return jsonError("Request access before reviewing this work", 403);
  }

  await upsertReview(session.user.id, kind, itemId, rating, text || null);
  if (ownerId) {
    await notify(ownerId, "review", {
      actorId: session.user.id,
      kind,
      itemId,
    });
  }
  return Response.json({ ok: true });
}

/** Remove the caller's review. JSON: {kind, itemId} */
export async function DELETE(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    itemId?: unknown;
  } | null;
  const kind =
    body?.kind === "series" ? "series" : body?.kind === "journal" ? "journal" : null;
  const itemId = typeof body?.itemId === "string" ? body.itemId : null;
  if (!kind || !itemId) return jsonError("kind and itemId are required", 400);
  await deleteReview(session.user.id, kind, itemId);
  return Response.json({ ok: true });
}
