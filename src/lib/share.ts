import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { shareLinks, journals, series } from "@/db/schema";
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { newId } from "@/lib/id";

export type ShareLink = typeof shareLinks.$inferSelect;

/**
 * Share-link cookie: tokens the visitor has redeemed via /share/<token>.
 * httpOnly — the browser only carries it; every access re-validates the
 * token against the database, so revoking a link cuts holders off at once.
 */
export const SHARE_COOKIE = "av-sh";
const MAX_COOKIE_TOKENS = 12;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export const EXPIRY_CHOICES = [1, 7, 30, 90] as const;

function activeWhere() {
  return or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, new Date()));
}

/** Create a link for a work the user owns; null when not the owner. */
export async function createShareLink(
  ownerId: string,
  kind: "journal" | "series",
  itemId: string,
  label: string,
  expiresDays: number | null
): Promise<ShareLink | null> {
  const owned =
    kind === "journal"
      ? await db
          .select({ id: journals.id })
          .from(journals)
          .where(and(eq(journals.id, itemId), eq(journals.ownerId, ownerId)))
      : await db
          .select({ id: series.id })
          .from(series)
          .where(and(eq(series.id, itemId), eq(series.ownerId, ownerId)));
  if (owned.length === 0) return null;

  const [row] = await db
    .insert(shareLinks)
    .values({
      id: newId(),
      token: randomBytes(24).toString("base64url"),
      kind,
      itemId,
      ownerId,
      label: label.trim().slice(0, 60) || "Share link",
      expiresAt:
        expiresDays !== null
          ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)
          : null,
    })
    .returning();
  return row;
}

/** The owner's links for one work, newest first (expired ones included). */
export async function listShareLinks(
  ownerId: string,
  kind: "journal" | "series",
  itemId: string
): Promise<ShareLink[]> {
  return db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.ownerId, ownerId),
        eq(shareLinks.kind, kind),
        eq(shareLinks.itemId, itemId)
      )
    )
    .orderBy(desc(shareLinks.createdAt));
}

/** Delete (revoke) a link — everyone who used it loses access immediately. */
export async function revokeShareLink(
  ownerId: string,
  linkId: string
): Promise<boolean> {
  const rows = await db
    .delete(shareLinks)
    .where(and(eq(shareLinks.id, linkId), eq(shareLinks.ownerId, ownerId)))
    .returning({ id: shareLinks.id });
  return rows.length > 0;
}

/** The active link behind a token, or null. */
export async function resolveShareToken(
  token: string
): Promise<ShareLink | null> {
  if (!TOKEN_RE.test(token)) return null;
  const rows = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.token, token), activeWhere()));
  return rows[0] ?? null;
}

export async function recordShareOpen(linkId: string) {
  await db
    .update(shareLinks)
    .set({
      openCount: sql`${shareLinks.openCount} + 1`,
      lastOpenedAt: new Date(),
    })
    .where(eq(shareLinks.id, linkId));
}

// ---------------------------------------------------------------------------
// Visitor-side helpers: which redeemed tokens does this request carry?
// ---------------------------------------------------------------------------

export async function shareTokensFromCookies(): Promise<string[]> {
  try {
    const raw = (await cookies()).get(SHARE_COOKIE)?.value ?? "";
    return raw.split(",").filter((t) => TOKEN_RE.test(t));
  } catch {
    // No request scope (e.g. build time) — no tokens.
    return [];
  }
}

/** New cookie value after redeeming a token (most recent last, capped). */
export function appendedCookieValue(existing: string, token: string): string {
  const tokens = existing.split(",").filter((t) => TOKEN_RE.test(t) && t !== token);
  tokens.push(token);
  return tokens.slice(-MAX_COOKIE_TOKENS).join(",");
}

export const SHARE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE,
};

/** Still-active links among the visitor's redeemed tokens. */
export async function activeLinksForTokens(
  tokens: string[]
): Promise<Pick<ShareLink, "kind" | "itemId">[]> {
  if (tokens.length === 0) return [];
  return db
    .select({ kind: shareLinks.kind, itemId: shareLinks.itemId })
    .from(shareLinks)
    .where(and(inArray(shareLinks.token, tokens), activeWhere()));
}

/** Does this request hold an active share link for the given journal? */
export async function shareGrantsJournal(journal: {
  id: string;
  seriesId: string | null;
}): Promise<boolean> {
  const links = await activeLinksForTokens(await shareTokensFromCookies());
  return links.some(
    (l) =>
      (l.kind === "journal" && l.itemId === journal.id) ||
      (l.kind === "series" &&
        journal.seriesId !== null &&
        l.itemId === journal.seriesId)
  );
}
