import { sessionFromRequest, jsonError } from "@/lib/api";
import { createGroup } from "@/lib/groups";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Create a group (the creator becomes its owner, with a #general channel). */
export async function POST(request: Request) {
  const limited = rateLimit(request, "groups-create", {
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return jsonError("Give the group a name", 400);
  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 300) || null
      : null;
  const icon =
    typeof body.icon === "string" ? body.icon.trim().slice(0, 8) || null : null;
  const visibility = body.visibility === "private" ? "private" : "public";

  if (!isTextSafe(name) || (description && !isTextSafe(description))) {
    return jsonError(UNSAFE_TEXT_ERROR, 400);
  }

  const result = await createGroup(session.user.id, {
    name,
    description,
    icon,
    visibility,
  });
  if ("error" in result) return jsonError(result.error, 400);
  return Response.json({ group: { id: result.id, name: result.name } });
}
