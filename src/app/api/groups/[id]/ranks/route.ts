import { sessionFromRequest, jsonError } from "@/lib/api";
import { canModerate, createRank, memberRole } from "@/lib/groups";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Owner/admin: create a rank. JSON: {name, color}. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request, "group-ranks", {
    limit: 15,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  if (!canModerate(await memberRole(id, session.user.id))) {
    return jsonError("Only the owner and admins can manage ranks", 403);
  }
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    color?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name : "";
  const color = typeof body?.color === "string" ? body.color : "";
  if (name && !isTextSafe(name)) return jsonError(UNSAFE_TEXT_ERROR, 400);
  const result = await createRank(id, name, color);
  if ("error" in result) return jsonError(result.error, 400);
  return Response.json({ rank: result });
}
