import webpush from "web-push";
import { db } from "@/db";
import { groups, pushSubscriptions, user } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { newId } from "@/lib/id";

/**
 * Web Push: fires OS-level notifications to every browser/device a user
 * enrolled — PC browsers (even closed windows) and Android via the installed
 * PWA. Configured with VAPID keys (generate once:
 * `npx web-push generate-vapid-keys`); with no keys set, everything here
 * no-ops so the app runs fine without push.
 */

let configured: boolean | undefined;

export function pushEnabled(): boolean {
  if (configured !== undefined) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return configured;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@vellum-books.org",
    pub,
    priv
  );
  configured = true;
  return configured;
}

export function vapidPublicKey(): string | null {
  return pushEnabled() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
}

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  await db
    .insert(pushSubscriptions)
    .values({
      id: newId(),
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}

export async function deleteSubscription(userId: string, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

interface PushPayload {
  title: string;
  body: string;
  /** Where a click lands (path, e.g. /groups/<id>?channel=<cid>). */
  url: string;
}

/** Send to every device the user enrolled; prune endpoints that bounced. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!pushEnabled()) return;
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  if (subs.length === 0) return;

  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 }
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = the browser dropped the subscription.
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error("[push] send failed:", status ?? err);
      }
    })
  );
  if (dead.length > 0) {
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.id, dead));
  }
}

/** Notification types that reach the user's devices (the Discord defaults). */
const PUSHABLE = new Set([
  "mention",
  "group_invite",
  "friend_request",
  "friend_accept",
]);

/**
 * Fire-and-forget push for an in-app notification. Called from notify() —
 * failures must never break the request that created the notification.
 */
export async function pushForNotification(
  userId: string,
  type: string,
  opts: { actorId?: string; kind?: string; itemId?: string }
) {
  try {
    if (!pushEnabled() || !PUSHABLE.has(type)) return;

    let actorName = "Someone";
    if (opts.actorId) {
      const rows = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, opts.actorId));
      actorName = rows[0]?.name ?? actorName;
    }
    let groupName: string | null = null;
    if (opts.kind === "group" && opts.itemId) {
      const rows = await db
        .select({ name: groups.name })
        .from(groups)
        .where(eq(groups.id, opts.itemId));
      groupName = rows[0]?.name ?? null;
    }

    const payloads: Record<string, PushPayload> = {
      mention: {
        title: groupName ? `${actorName} — ${groupName}` : actorName,
        body: `${actorName} mentioned you`,
        url: opts.itemId ? `/groups/${opts.itemId}` : "/groups",
      },
      group_invite: {
        title: "Group invite",
        body: `${actorName} invited you to ${groupName ?? "a group"}`,
        url: opts.itemId ? `/groups/${opts.itemId}` : "/groups",
      },
      friend_request: {
        title: "Friend request",
        body: `${actorName} sent you a friend request`,
        url: "/friends",
      },
      friend_accept: {
        title: "Friend request accepted",
        body: `${actorName} accepted your friend request`,
        url: "/friends",
      },
    };
    const payload = payloads[type];
    if (payload) await sendPushToUser(userId, payload);
  } catch (err) {
    console.error("[push] notification hook failed:", err);
  }
}
