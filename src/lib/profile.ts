import { db } from "@/db";
import { user, follows, friendships } from "@/db/schema";
import { and, eq, ilike, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { isTextSafe } from "@/lib/safety";

export type PublicUser = typeof user.$inferSelect;

export const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "arcadia",
  "vellum",
  "support",
  "help",
  "api",
  "settings",
  "dashboard",
  "browse",
  "login",
  "signup",
  "welcome",
  "me",
  "root",
  "moderator",
  "official",
]);

/** null when valid; otherwise a human-readable reason. */
export function usernameProblem(username: string): string | null {
  const u = username.toLowerCase();
  if (!USERNAME_RE.test(u)) {
    return "Usernames are 3-30 characters: letters, numbers, - or _, starting with a letter or number.";
  }
  if (RESERVED.has(u)) return "That username is reserved.";
  if (!isTextSafe(u)) return "That username isn't allowed.";
  return null;
}

export async function getUserByUsername(username: string) {
  const rows = await db
    .select()
    .from(user)
    .where(sql`lower(${user.username}) = lower(${username})`);
  return rows[0] ?? null;
}

export async function getUserById(id: string) {
  const rows = await db.select().from(user).where(eq(user.id, id));
  return rows[0] ?? null;
}

export async function isUserBanned(userId: string): Promise<boolean> {
  const rows = await db
    .select({ banned: user.banned })
    .from(user)
    .where(eq(user.id, userId));
  return rows[0]?.banned ?? false;
}

/** Banned owners among the given user ids (batch check for listings). */
export async function bannedUserIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, ids), eq(user.banned, true)));
  return new Set(rows.map((r) => r.id));
}

export async function isUsernameTaken(username: string, excludeUserId?: string) {
  const existing = await getUserByUsername(username);
  return existing !== null && existing.id !== excludeUserId;
}

/** A safe, free handle derived from the display name. */
export async function suggestUsername(name: string): Promise<string> {
  let base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  if (base.length < 3 || RESERVED.has(base) || !isTextSafe(base)) {
    base = "scribe";
  }
  if (!(await isUsernameTaken(base))) return base;
  for (let i = 0; i < 50; i++) {
    const candidate = `${base}-${Math.floor(100 + Math.random() * 900)}`;
    if (!(await isUsernameTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now() % 100000}`;
}

export interface UserSearchResult {
  id: string;
  name: string;
  username: string;
  avatarImageId: string | null;
  bio: string | null;
}

/**
 * Discord-style lookup: matches the unique @username or the (non-unique)
 * display name. Only onboarded users who opted into search appear; exact
 * username hits rank first, then username prefixes, then name matches.
 */
export async function searchUsers(
  q: string,
  limit = 20
): Promise<UserSearchResult[]> {
  const raw = q.trim().replace(/^@/, "");
  if (raw.length < 2) return [];
  // Escape LIKE wildcards so "a_b" searches literally.
  const term = raw.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      avatarImageId: user.avatarImageId,
      bio: user.bio,
      visibility: user.profileVisibility,
    })
    .from(user)
    .where(
      and(
        isNotNull(user.username),
        eq(user.searchable, true),
        eq(user.banned, false),
        ne(user.profileVisibility, "private"),
        or(ilike(user.username, `%${term}%`), ilike(user.name, `%${term}%`))
      )
    )
    .limit(200);
  const needle = raw.toLowerCase();
  const rank = (r: (typeof rows)[number]) => {
    const uname = (r.username ?? "").toLowerCase();
    const name = r.name.toLowerCase();
    if (uname === needle) return 0;
    if (uname.startsWith(needle)) return 1;
    if (name === needle) return 2;
    if (name.startsWith(needle)) return 3;
    if (uname.includes(needle)) return 4;
    return 5;
  };
  return rows
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      name: r.name,
      username: r.username as string,
      avatarImageId: r.avatarImageId,
      bio: r.bio,
    }));
}

// ---------------------------------------------------------------------------
// Relationship helpers
// ---------------------------------------------------------------------------

export async function areFriends(a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
          and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a))
        )
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Whether `viewerId` may see `profile` under its visibility setting. */
export async function canViewProfile(
  profile: PublicUser,
  viewerId: string | null
): Promise<boolean> {
  if (viewerId === profile.id) return true;
  switch (profile.profileVisibility) {
    case "public":
      return true;
    case "friends":
      return viewerId !== null && (await areFriends(viewerId, profile.id));
    default:
      return false;
  }
}

export async function relationshipCounts(userId: string) {
  const [followers] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followingId, userId));
  const [following] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.followerId, userId));
  const [friends] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          eq(friendships.requesterId, userId),
          eq(friendships.addresseeId, userId)
        )
      )
    );
  return {
    followers: followers?.n ?? 0,
    following: following?.n ?? 0,
    friends: friends?.n ?? 0,
  };
}
