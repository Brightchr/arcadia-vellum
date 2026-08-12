import { sessionFromRequest, jsonError } from "@/lib/api";
import { canModerate, createChannel, memberRole } from "@/lib/groups";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Owner/admin: add a channel. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request, "group-channels", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const { id } = await params;
  if (!canModerate(await memberRole(id, session.user.id))) {
    return jsonError("Only the owner and admins can manage channels", 403);
  }
  const body = (await request.json().catch(() => null)) as {
    name?: string;
  } | null;
  if (!body?.name?.trim()) return jsonError("Name the channel", 400);
  const result = await createChannel(id, body.name);
  if ("error" in result) return jsonError(result.error, 400);
  return Response.json({ channel: result });
}
