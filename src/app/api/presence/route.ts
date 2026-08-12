import { sessionFromRequest, jsonError } from "@/lib/api";
import { touchPresence } from "@/lib/presence";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Heartbeat from the signed-in client — marks the user online. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "presence", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  await touchPresence(session.user.id);
  return Response.json({ ok: true });
}
