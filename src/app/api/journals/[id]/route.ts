import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  getOwnedJournal,
  updateJournal,
  deleteJournal,
  type Journal,
} from "@/lib/journals";
import { isThemeId } from "@/lib/themes";
import {
  findOrCreateSeries,
  deleteSeriesIfEmpty,
  nextVolumeNumber,
} from "@/lib/series";

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
      | "theme"
      | "visibility"
      | "gdocFileId"
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
    if (!isThemeId(body.theme)) return jsonError("Unknown theme", 400);
    patch.theme = body.theme;
  }
  if (body.visibility === "public" || body.visibility === "private") {
    patch.visibility = body.visibility;
  }
  if (
    typeof body.gdocFileId === "string" &&
    body.gdocFileId.trim() &&
    journal.sourceType === "gdoc"
  ) {
    patch.gdocFileId = body.gdocFileId.trim();
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

  if (Object.keys(patch).length === 0) {
    return jsonError("Nothing to update", 400);
  }

  const updated = await updateJournal(id, patch);

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

  await deleteJournal(id);
  if (journal.seriesId) await deleteSeriesIfEmpty(journal.seriesId);
  return Response.json({ ok: true });
}
