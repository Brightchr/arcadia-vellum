import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  createShareLink,
  listShareLinks,
  EXPIRY_CHOICES,
} from "@/lib/share";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";

export const runtime = "nodejs";

function parseKind(v: unknown): "journal" | "series" | null {
  return v === "journal" || v === "series" ? v : null;
}

/** The owner's share links for one work (?kind=&itemId=). */
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const sp = new URL(request.url).searchParams;
  const kind = parseKind(sp.get("kind"));
  const itemId = sp.get("itemId");
  if (!kind || !itemId) return jsonError("kind and itemId are required", 400);
  const links = await listShareLinks(session.user.id, kind, itemId);
  return Response.json(
    {
      links: links.map((l) => ({
        id: l.id,
        url: `/share/${l.token}`,
        label: l.label,
        expiresAt: l.expiresAt,
        openCount: l.openCount,
        lastOpenedAt: l.lastOpenedAt,
        createdAt: l.createdAt,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Mint a link: { kind, itemId, label?, expiresDays? } (owner only). */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    itemId?: unknown;
    label?: unknown;
    expiresDays?: unknown;
  } | null;
  const kind = parseKind(body?.kind);
  if (!body || !kind || typeof body.itemId !== "string") {
    return jsonError("kind and itemId are required", 400);
  }
  const label = typeof body.label === "string" ? body.label : "";
  if (label && !isTextSafe(label)) return jsonError(UNSAFE_TEXT_ERROR, 400);
  const expiresDays =
    typeof body.expiresDays === "number" &&
    (EXPIRY_CHOICES as readonly number[]).includes(body.expiresDays)
      ? body.expiresDays
      : null;

  const link = await createShareLink(
    session.user.id,
    kind,
    body.itemId,
    label,
    expiresDays
  );
  if (!link) return jsonError("Not found", 404);
  return Response.json(
    { link: { id: link.id, url: `/share/${link.token}`, label: link.label } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
