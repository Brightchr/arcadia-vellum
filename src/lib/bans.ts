import { db } from "@/db";
import { ipBans, session, user } from "@/db/schema";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { newId } from "@/lib/id";
import { banReasonLabel } from "@/lib/ban-reasons";

/**
 * Account-ban state and IP bans. Lives apart from lib/admin.ts because
 * lib/auth.ts hooks into it at sign-in — importing the whole admin module
 * there would drag notification/social code into the auth bundle.
 */

export interface ActiveBan {
  reason: string | null;
  until: Date | null;
}

/**
 * The user's active ban, or null. Suspensions that have run out are cleared
 * here as a side effect — the first sign-in attempt after expiry unbans.
 */
export async function getActiveBan(userId: string): Promise<ActiveBan | null> {
  const rows = await db
    .select({
      banned: user.banned,
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
    })
    .from(user)
    .where(eq(user.id, userId));
  const row = rows[0];
  if (!row?.banned) return null;
  if (row.bannedUntil && row.bannedUntil.getTime() <= Date.now()) {
    await db
      .update(user)
      .set({
        banned: false,
        bannedAt: null,
        bannedUntil: null,
        banReason: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
    return null;
  }
  return { reason: row.banReason, until: row.bannedUntil };
}

/** The sentence a banned account sees when it tries to sign in. */
export function banLoginMessage(ban: ActiveBan): string {
  const reason = banReasonLabel(ban.reason);
  if (ban.until) {
    const until = ban.until.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return `This account is suspended until ${until}. Reason: ${reason}.`;
  }
  return `This account has been banned. Reason: ${reason}.`;
}

/** Signs the user out everywhere (subject to the ~5 min session cookie cache). */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.delete(session).where(eq(session.userId, userId));
}

// ---------------------------------------------------------------------------
// IP bans
// ---------------------------------------------------------------------------

/** True when this address is barred from sign-in/sign-up. */
export async function isIpBanned(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  const rows = await db
    .select({ id: ipBans.id })
    .from(ipBans)
    .where(
      and(
        eq(ipBans.ip, ip),
        or(isNull(ipBans.expiresAt), gt(ipBans.expiresAt, new Date()))
      )
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Bans every distinct IP the target's auth sessions were created from.
 * Returns the number of addresses added.
 */
export async function banKnownIpsForUser(
  targetUserId: string,
  reason: string,
  adminId: string,
  expiresAt: Date | null
): Promise<number> {
  const rows = await db
    .selectDistinct({ ip: session.ipAddress })
    .from(session)
    .where(eq(session.userId, targetUserId));
  const ips = rows
    .map((r) => r.ip?.trim())
    .filter((ip): ip is string => Boolean(ip) && ip !== "unknown");
  if (ips.length === 0) return 0;
  // On an IP already banned for ANOTHER account, keep that row's ownership —
  // reassigning it would make unbanning this user silently lift the other
  // user's network ban. Only the expiry widens (permanent wins).
  await db
    .insert(ipBans)
    .values(
      ips.map((ip) => ({
        id: newId(),
        ip,
        reason,
        targetUserId,
        createdBy: adminId,
        expiresAt,
      }))
    )
    .onConflictDoUpdate({
      target: ipBans.ip,
      set: {
        expiresAt:
          expiresAt === null
            ? sql`null`
            : sql`case when ${ipBans.expiresAt} is null then null
                  else greatest(${ipBans.expiresAt}, ${expiresAt.toISOString()}::timestamp) end`,
      },
    });
  return ips.length;
}

/** Lifts IP bans tied to this user (used when unbanning the account). */
export async function liftIpBansForUser(targetUserId: string): Promise<void> {
  await db.delete(ipBans).where(eq(ipBans.targetUserId, targetUserId));
}

export interface IpBanView {
  ip: string;
  reason: string;
  createdAt: Date;
  expiresAt: Date | null;
}

/** Active IP bans tied to a user, for the admin drill-down page. */
export async function listIpBansForUser(
  targetUserId: string
): Promise<IpBanView[]> {
  return db
    .select({
      ip: ipBans.ip,
      reason: ipBans.reason,
      createdAt: ipBans.createdAt,
      expiresAt: ipBans.expiresAt,
    })
    .from(ipBans)
    .where(eq(ipBans.targetUserId, targetUserId));
}

/** Distinct IPs seen on the user's auth sessions (admin drill-down). */
export async function knownIpsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({
      ip: session.ipAddress,
      last: sql<Date>`max(${session.updatedAt})`,
    })
    .from(session)
    .where(eq(session.userId, userId))
    .groupBy(session.ipAddress)
    .orderBy(sql`max(${session.updatedAt}) desc`)
    .limit(20);
  return rows
    .map((r) => r.ip?.trim())
    .filter((ip): ip is string => Boolean(ip) && ip !== "unknown");
}

/** Batch cleanup used by the daily sweep: expired IP bans disappear. */
export async function sweepExpiredIpBans(): Promise<void> {
  await db.delete(ipBans).where(lte(ipBans.expiresAt, new Date()));
}
