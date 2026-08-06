import { db } from "@/db";
import { accessGrants, user } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { newId } from "@/lib/id";
import { areFriends, bannedUserIds, isUserBanned } from "@/lib/profile";
import {
  activeLinksForTokens,
  shareGrantsJournal,
  shareTokensFromCookies,
} from "@/lib/share";
import type { Journal } from "@/lib/journals";

export type GrantStatus = "none" | "pending" | "granted";

/** The viewer's grant on a specific work (journal or series level). */
export async function grantStatus(
  userId: string,
  kind: "journal" | "series",
  itemId: string
): Promise<GrantStatus> {
  const rows = await db
    .select({ status: accessGrants.status })
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.kind, kind),
        eq(accessGrants.itemId, itemId),
        eq(accessGrants.userId, userId)
      )
    );
  return (rows[0]?.status as GrantStatus | undefined) ?? "none";
}

/**
 * Full-content access check for a journal. Restricted volumes honor a grant
 * on the volume itself or on its series (series grants cover every volume).
 */
export async function canAccessJournal(
  viewerId: string | null,
  journal: Journal
): Promise<boolean> {
  if (viewerId === journal.ownerId) return true;
  // A banned owner's works are hidden from everyone but the owner.
  if (await isUserBanned(journal.ownerId)) return false;
  // Unlisted works need a share link — only listed public works are open.
  if (journal.visibility === "public" && journal.listed) return true;
  // A redeemed share link opens the work regardless of its visibility.
  if (await shareGrantsJournal(journal)) return true;
  if (journal.visibility === "public") return false;
  if (viewerId === null) return false;
  switch (journal.visibility) {
    case "friends":
      return areFriends(viewerId, journal.ownerId);
    case "restricted": {
      if ((await grantStatus(viewerId, "journal", journal.id)) === "granted") {
        return true;
      }
      if (
        journal.seriesId &&
        (await grantStatus(viewerId, "series", journal.seriesId)) === "granted"
      ) {
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/** Batch variant for series pages: which of these volumes can the viewer open? */
export async function accessibleJournalIds(
  viewerId: string | null,
  journals: Journal[]
): Promise<Set<string>> {
  const ok = new Set<string>();
  const friendCache = new Map<string, boolean>();
  const [banned, shareLinks] = await Promise.all([
    bannedUserIds([...new Set(journals.map((j) => j.ownerId))]),
    activeLinksForTokens(await shareTokensFromCookies()),
  ]);
  const sharedTo = (j: Journal) =>
    shareLinks.some(
      (l) =>
        (l.kind === "journal" && l.itemId === j.id) ||
        (l.kind === "series" && j.seriesId !== null && l.itemId === j.seriesId)
    );
  for (const j of journals) {
    if (viewerId === j.ownerId) {
      ok.add(j.id);
      continue;
    }
    if (banned.has(j.ownerId)) continue;
    if (j.visibility === "public" && j.listed) {
      ok.add(j.id);
      continue;
    }
    if (sharedTo(j)) {
      ok.add(j.id);
      continue;
    }
    if (viewerId === null) continue;
    if (j.visibility === "friends") {
      if (!friendCache.has(j.ownerId)) {
        friendCache.set(j.ownerId, await areFriends(viewerId, j.ownerId));
      }
      if (friendCache.get(j.ownerId)) ok.add(j.id);
      continue;
    }
    if (j.visibility === "restricted") {
      if (await canAccessJournal(viewerId, j)) ok.add(j.id);
    }
  }
  return ok;
}

/** File a request (idempotent — an existing row of either status stands). */
export async function requestAccess(
  userId: string,
  kind: "journal" | "series",
  itemId: string
) {
  await db
    .insert(accessGrants)
    .values({ id: newId(), kind, itemId, userId, status: "pending" })
    .onConflictDoNothing();
}

export async function setGrant(
  kind: "journal" | "series",
  itemId: string,
  userId: string,
  granted: boolean
) {
  if (granted) {
    await db
      .insert(accessGrants)
      .values({ id: newId(), kind, itemId, userId, status: "granted" })
      .onConflictDoUpdate({
        target: [accessGrants.kind, accessGrants.itemId, accessGrants.userId],
        set: { status: "granted" },
      });
  } else {
    await db
      .delete(accessGrants)
      .where(
        and(
          eq(accessGrants.kind, kind),
          eq(accessGrants.itemId, itemId),
          eq(accessGrants.userId, userId)
        )
      );
  }
}

export interface GrantView {
  userId: string;
  status: "pending" | "granted";
  name: string;
  username: string | null;
  avatarImageId: string | null;
}

/** Requests + grants on a work, for the owner's management panel. */
export async function listGrants(
  kind: "journal" | "series",
  itemId: string
): Promise<GrantView[]> {
  const rows = await db
    .select({
      userId: accessGrants.userId,
      status: accessGrants.status,
      name: user.name,
      username: user.username,
      avatarImageId: user.avatarImageId,
    })
    .from(accessGrants)
    .innerJoin(user, eq(accessGrants.userId, user.id))
    .where(and(eq(accessGrants.kind, kind), eq(accessGrants.itemId, itemId)));
  return rows as GrantView[];
}

/** Discoverable = shows up in browse and has a public homepage teaser. */
export function isDiscoverable(visibility: Journal["visibility"]): boolean {
  return visibility === "public" || visibility === "restricted";
}

export async function grantStatuses(
  userId: string,
  keys: { kind: "journal" | "series"; itemId: string }[]
): Promise<Map<string, GrantStatus>> {
  const map = new Map<string, GrantStatus>();
  if (keys.length === 0) return map;
  const rows = await db
    .select()
    .from(accessGrants)
    .where(
      and(
        eq(accessGrants.userId, userId),
        inArray(
          accessGrants.itemId,
          keys.map((k) => k.itemId)
        )
      )
    );
  for (const r of rows) {
    map.set(`${r.kind}:${r.itemId}`, r.status as GrantStatus);
  }
  return map;
}
