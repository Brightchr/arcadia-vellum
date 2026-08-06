import { db } from "@/db";
import { playlists, playlistItems, journals, savedItems } from "@/db/schema";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { newId } from "@/lib/id";

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

export async function updatePlaylist(
  id: string,
  patch: { name?: string; icon?: string | null }
) {
  await db
    .update(playlists)
    .set({
      ...(patch.name !== undefined
        ? { name: patch.name.trim().slice(0, 80) }
        : {}),
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
    })
    .where(eq(playlists.id, id));
}

export async function deletePlaylist(id: string) {
  await db.delete(playlists).where(eq(playlists.id, id));
}

/** Items in play order, with journal details resolved for the owner. */
export async function listPlaylistItems(
  playlistId: string,
  ownerId: string
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
    playable: r.visibility === "public" || r.journalOwnerId === ownerId,
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
