import { db } from "@/db";
import { playlists, playlistItems, journals, savedItems } from "@/db/schema";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { newId } from "@/lib/id";
import { areFriends } from "@/lib/profile";

export type Playlist = typeof playlists.$inferSelect;

export interface PlaylistItemView {
  journalId: string;
  sortIndex: number;
  title: string;
  slug: string;
  theme: string;
  coverImageId: string | null;
  /** False when the work went private/vanished — shown but unplayable. */
  playable: boolean;
}

export async function createPlaylist(ownerId: string, name: string) {
  const [row] = await db
    .insert(playlists)
    .values({ id: newId(), ownerId, name: name.trim().slice(0, 80) })
    .returning();
  return row;
}

export async function getOwnedPlaylist(id: string, ownerId: string) {
  const rows = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.ownerId, ownerId)));
  return rows[0] ?? null;
}

export async function listPlaylistsForOwner(ownerId: string) {
  return db
    .select()
    .from(playlists)
    .where(eq(playlists.ownerId, ownerId))
    .orderBy(asc(playlists.createdAt));
}

/** The playlist if `viewerId` may open it: owner, public, or friends-only. */
export async function getViewablePlaylist(
  id: string,
  viewerId: string | null
): Promise<Playlist | null> {
  const rows = await db.select().from(playlists).where(eq(playlists.id, id));
  const p = rows[0];
  if (!p) return null;
  if (viewerId === p.ownerId || p.visibility === "public") return p;
  if (p.visibility === "friends" && viewerId) {
    return (await areFriends(viewerId, p.ownerId)) ? p : null;
  }
  return null;
}

/**
 * `ownerId`'s shared playlists as `viewerId` sees them (profile page):
 * public ones for everyone, friends-only ones for friends. The owner sees
 * everything they've shared.
 */
export async function listSharedPlaylists(
  ownerId: string,
  viewerId: string | null
): Promise<Playlist[]> {
  const all = await listPlaylistsForOwner(ownerId);
  const shared = all.filter((p) => p.visibility !== "private");
  if (viewerId === ownerId) return shared;
  const friend = viewerId ? await areFriends(viewerId, ownerId) : false;
  return shared.filter(
    (p) => p.visibility === "public" || (p.visibility === "friends" && friend)
  );
}

/** journalId counts per playlist, for shelf/profile listings. */
export async function playlistItemCounts(
  playlistIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (playlistIds.length === 0) return map;
  const rows = await db
    .select({
      playlistId: playlistItems.playlistId,
      n: sql<number>`count(*)::int`,
    })
    .from(playlistItems)
    .where(inArray(playlistItems.playlistId, playlistIds))
    .groupBy(playlistItems.playlistId);
  for (const r of rows) map.set(r.playlistId, r.n);
  return map;
}

export async function updatePlaylist(
  id: string,
  patch: {
    name?: string;
    icon?: string | null;
    visibility?: "private" | "friends" | "public";
  }
) {
  await db
    .update(playlists)
    .set({
      ...(patch.name !== undefined
        ? { name: patch.name.trim().slice(0, 80) }
        : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
      ...(patch.visibility !== undefined
        ? { visibility: patch.visibility }
        : {}),
    })
    .where(eq(playlists.id, id));
}

export async function deletePlaylist(id: string) {
  await db.delete(playlists).where(eq(playlists.id, id));
}

/** Items in play order; `playable` is from the viewer's perspective. */
export async function listPlaylistItems(
  playlistId: string,
  viewerId: string | null
): Promise<PlaylistItemView[]> {
  const rows = await db
    .select({
      journalId: playlistItems.journalId,
      sortIndex: playlistItems.sortIndex,
      title: journals.title,
      slug: journals.slug,
      theme: journals.theme,
      coverImageId: journals.coverImageId,
      visibility: journals.visibility,
      journalOwnerId: journals.ownerId,
    })
    .from(playlistItems)
    .innerJoin(journals, eq(playlistItems.journalId, journals.id))
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(asc(playlistItems.sortIndex));
  return rows.map((r) => ({
    journalId: r.journalId,
    sortIndex: r.sortIndex,
    title: r.title,
    slug: r.slug,
    theme: r.theme,
    coverImageId: r.coverImageId,
    playable: r.visibility === "public" || r.journalOwnerId === viewerId,
  }));
}

export async function addPlaylistItem(playlistId: string, journalId: string) {
  const existing = await db
    .select({ sortIndex: playlistItems.sortIndex })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId));
  const next = existing.reduce((m, r) => Math.max(m, r.sortIndex), -1) + 1;
  await db
    .insert(playlistItems)
    .values({ playlistId, journalId, sortIndex: next })
    .onConflictDoNothing();
}

export async function removePlaylistItem(playlistId: string, journalId: string) {
  await db
    .delete(playlistItems)
    .where(
      and(
        eq(playlistItems.playlistId, playlistId),
        eq(playlistItems.journalId, journalId)
      )
    );
}

/** Replace the play order with the given journalId sequence. */
export async function reorderPlaylist(playlistId: string, order: string[]) {
  for (let i = 0; i < order.length; i++) {
    await db
      .update(playlistItems)
      .set({ sortIndex: i })
      .where(
        and(
          eq(playlistItems.playlistId, playlistId),
          eq(playlistItems.journalId, order[i])
        )
      );
  }
}

/** Audiobooks the user can add: their own plus saved public ones. */
export async function addableAudiobooks(ownerId: string) {
  const saved = await db
    .select({ itemId: savedItems.itemId })
    .from(savedItems)
    .where(
      and(eq(savedItems.userId, ownerId), eq(savedItems.kind, "journal"))
    );
  const savedIds = saved.map((s) => s.itemId);
  const rows = await db
    .select({
      id: journals.id,
      title: journals.title,
      visibility: journals.visibility,
      ownerId: journals.ownerId,
    })
    .from(journals)
    .where(
      and(
        eq(journals.sourceType, "audio"),
        savedIds.length > 0
          ? or(eq(journals.ownerId, ownerId), inArray(journals.id, savedIds))
          : eq(journals.ownerId, ownerId)
      )
    );
  return rows.filter(
    (r) => r.ownerId === ownerId || r.visibility === "public"
  );
}
