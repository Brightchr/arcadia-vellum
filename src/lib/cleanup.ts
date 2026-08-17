import { db } from "@/db";
import { notifications, session, shareLinks, verification } from "@/db/schema";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { sweepExpiredIpBans } from "@/lib/bans";

/** Read notifications older than this are considered dead weight. */
const NOTIFICATION_RETENTION_DAYS = 30;

/**
 * Deletes rows nothing will ever read again: expired auth sessions and
 * verification codes, month-old read notifications, and share links past
 * their expiry. Each delete is independent — one failing doesn't stop the
 * rest.
 */
export async function runCleanupSweep(): Promise<void> {
  const now = new Date();
  const notificationCutoff = new Date(
    now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  const jobs: Array<[string, Promise<unknown>]> = [
    ["sessions", db.delete(session).where(lt(session.expiresAt, now))],
    [
      "verifications",
      db.delete(verification).where(lt(verification.expiresAt, now)),
    ],
    [
      "notifications",
      db
        .delete(notifications)
        .where(
          and(
            eq(notifications.read, true),
            lt(notifications.createdAt, notificationCutoff)
          )
        ),
    ],
    [
      "share links",
      db
        .delete(shareLinks)
        .where(
          and(isNotNull(shareLinks.expiresAt), lt(shareLinks.expiresAt, now))
        ),
    ],
    ["ip bans", sweepExpiredIpBans()],
  ];

  for (const [what, job] of jobs) {
    try {
      await job;
    } catch (error) {
      console.error(`[cleanup] failed to sweep ${what}:`, error);
    }
  }
}
