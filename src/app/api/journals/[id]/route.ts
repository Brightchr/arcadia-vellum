import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  getOwnedJournal,
  updateJournal,
  deleteJournal,
  type Journal,
} from "@/lib/journals";
import { parseCoverLayout } from "@/lib/cover-layout";
import { isValidThemeForUser } from "@/lib/custom-themes";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";
import {
  findOrCreateSeries,
  deleteSeriesIfEmpty,
  nextVolumeNumber,
} from "@/lib/series";
import { seriesFollowerIds, followerIds } from "@/lib/social";
import { notifyMany } from "@/lib/notifications";
import { deleteObjects, journalStorageKeys } from "@/lib/media";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  const patch: Partial<
    Pick<
      Journal,
      | "title"
      | "subtitle"
      | "author"
      | "seriesId"
      | "volumeNumber"
      | "partNumber"
      | "theme"
      | "visibility"
      | "listed"
      | "description"
      | "featured"
      | "gdocFileId"
      | "coverLayout"
    >
  > = {};

  if (typeof body.title === "string" && body.title.trim()) {
    if (body.title.trim().length > 120) return jsonError("Title too long", 400);
    patch.title = body.title.trim();
  }
  if (typeof body.subtitle === "string") {
    patch.subtitle = body.subtitle.trim().slice(0, 160) || null;
  }
  if (typeof body.author === "string") {
    patch.author = body.author.trim().slice(0, 80) || null;
  }
  if (typeof body.theme === "string") {
    if (!(await isValidThemeForUser(body.theme, session.user.id))) {
      return jsonError("Unknown theme", 400);
    }
    patch.theme = body.theme;
  }
  if (
    body.visibility === "public" ||
    body.visibility === "friends" ||
    body.visibility === "restricted" ||
    body.visibility === "private"
  ) {
    patch.visibility = body.visibility;
    // Featuring only makes sense for works with a public face.
    if (body.visibility === "friends" || body.visibility === "private") {
      patch.featured = false;
    }
  }
  if (typeof body.listed === "boolean") {
    patch.listed = body.listed;
  }
  if (typeof body.description === "string") {
    const description = body.description.trim().slice(0, 2000);
    if (description && !isTextSafe(description)) {
      return jsonError(UNSAFE_TEXT_ERROR, 400);
    }
    patch.description = description || null;
  }
  if (typeof body.featured === "boolean") {
    const effective = patch.visibility ?? journal.visibility;
    patch.featured =
      body.featured && (effective === "public" || effective === "restricted");
  }
  if (
    typeof body.gdocFileId === "string" &&
    body.gdocFileId.trim() &&
    journal.sourceType === "gdoc"
  ) {
    patch.gdocFileId = body.gdocFileId.trim();
  }

  // Cover text layout: an object stores (validated/clamped), null resets to
  // the default layout.
  if (body.coverLayout === null) {
    patch.coverLayout = null;
  } else if (typeof body.coverLayout === "object" && body.coverLayout) {
    patch.coverLayout = JSON.stringify(parseCoverLayout(body.coverLayout));
  }

  // Series membership: a name assigns (find-or-create), empty string removes.
  if (typeof body.seriesName === "string") {
    const name = body.seriesName.trim();
    if (name) {
      const s = await findOrCreateSeries(session.user.id, name);
      patch.seriesId = s.id;
      if (patch.volumeNumber === undefined && journal.volumeNumber === null) {
        patch.volumeNumber = await nextVolumeNumber(s.id);
      }
    } else {
      patch.seriesId = null;
      patch.volumeNumber = null;
      patch.partNumber = null;
    }
  }
  if (typeof body.volumeNumber === "number" || body.volumeNumber === null) {
    patch.volumeNumber =
      typeof body.volumeNumber === "number" &&
      Number.isFinite(body.volumeNumber) &&
      body.volumeNumber > 0
        ? Math.floor(body.volumeNumber)
        : null;
  }
  if (typeof body.partNumber === "number" || body.partNumber === null) {
    patch.partNumber =
      typeof body.partNumber === "number" &&
      Number.isFinite(body.partNumber) &&
      body.partNumber > 0
        ? Math.floor(body.partNumber)
        : null;
  }
  // A part only makes sense within a numbered volume.
  const volumeAfterPatch =
    patch.volumeNumber !== undefined ? patch.volumeNumber : journal.volumeNumber;
  if (volumeAfterPatch === null) {
    patch.partNumber = null;
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("Nothing to update", 400);
  }

  const updated = await updateJournal(id, patch);

  // Publishing moment: tell series followers and the author's followers.
  // Unlisted publishes stay quiet on purpose.
  const wasDiscoverable =
    journal.visibility === "public" || journal.visibility === "restricted";
  const isDiscoverableNow =
    (updated?.visibility === "public" || updated?.visibility === "restricted") &&
    updated?.listed;
  if (!wasDiscoverable && isDiscoverableNow) {
    if (updated.seriesId) {
      await notifyMany(await seriesFollowerIds(updated.seriesId), "new_volume", {
        actorId: session.user.id,
        kind: "series",
        itemId: updated.seriesId,
      });
    }
    await notifyMany(await followerIds(session.user.id), "new_work", {
      actorId: session.user.id,
      kind: updated.seriesId ? "series" : "journal",
      itemId: updated.seriesId ?? updated.id,
    });
  }

  // Tidy up a series the journal just left.
  if (journal.seriesId && patch.seriesId !== undefined && patch.seriesId !== journal.seriesId) {
    await deleteSeriesIfEmpty(journal.seriesId);
  }

  return Response.json({ journal: updated });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) return jsonError("Journal not found", 404);

  // Bucket keys must be collected before the row cascade wipes them.
  const storageKeys = await journalStorageKeys(id);
  await deleteJournal(id);
  await deleteObjects(storageKeys);
  if (journal.seriesId) await deleteSeriesIfEmpty(journal.seriesId);
  return Response.json({ ok: true });
}
