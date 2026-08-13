import { sessionFromRequest, jsonError } from "@/lib/api";
import {
  deleteSubscription,
  saveSubscription,
  vapidPublicKey,
} from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** The VAPID public key the browser needs to subscribe (null = push off). */
export async function GET() {
  return Response.json({ key: vapidPublicKey() });
}

/** Enroll this browser/device for push. JSON: a PushSubscription. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "push-subscribe", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | null;
  if (
    typeof body?.endpoint !== "string" ||
    !body.endpoint.startsWith("https://") ||
    typeof body.keys?.p256dh !== "string" ||
    typeof body.keys?.auth !== "string"
  ) {
    return jsonError("Invalid subscription", 400);
  }
  await saveSubscription(session.user.id, {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  });
  return Response.json({ ok: true });
}

/** Drop this browser/device. JSON: {endpoint}. */
export async function DELETE(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
  } | null;
  if (typeof body?.endpoint !== "string") {
    return jsonError("endpoint is required", 400);
  }
  await deleteSubscription(session.user.id, body.endpoint);
  return Response.json({ ok: true });
}
