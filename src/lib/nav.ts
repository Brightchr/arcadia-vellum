import { db } from "@/db";
import { journals, playlistItems } from "@/db/schema";
import { and, asc, inArray, isNotNull, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { listSeriesForOwner } from "@/lib/series";
import { listSaved } from "@/lib/saves";
import { listPlaylistsForOwner } from "@/lib/playlists";
import { unreadCount } from "@/lib/notifications";
import type { NavUser, SidebarPin } from "@/components/nav/AppShell";

/** First cover-image id per series, for sidebar art. */
async function seriesCovers(
  seriesIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (seriesIds.length === 0) return map;
  const rows = await db
    .select({ seriesId: journals.seriesId, coverImageId: journals.coverImageId })
    .from(journals)
    .where(
      and(
        inArray(journals.seriesId, seriesIds),
        isNotNull(journals.coverImageId)
      )
    );
  for (const r of rows) {
    if (r.seriesId && r.coverImageId && !map.has(r.seriesId)) {
      map.set(r.seriesId, r.coverImageId);
    }
  }
  return map;
}

async function journalCovers(
  journalIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (journalIds.length === 0) return map;
  const rows = await db
    .select({ id: journals.id, coverImageId: journals.coverImageId })
    .from(journals)
    .where(inArray(journals.id, journalIds));
  for (const r of rows) {
    if (r.coverImageId) map.set(r.id, r.coverImageId);
  }
  return map;
}

/** First covered item per playlist, for sidebar art. */
async function playlistCovers(
  playlistIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (playlistIds.length === 0) return map;
  const rows = await db
    .select({
      playlistId: playlistItems.playlistId,
      coverImageId: journals.coverImageId,
    })
    .from(playlistItems)
    .innerJoin(journals, eq(playlistItems.journalId, journals.id))
    .where(inArray(playlistItems.playlistId, playlistIds))
    .orderBy(asc(playlistItems.sortIndex));
  for (const r of rows) {
    if (r.coverImageId && !map.has(r.playlistId)) {
      map.set(r.playlistId, r.coverImageId);
    }
  }
  return map;
}

interface SessionProfileFields {
  username?: string | null;
  avatarImageId?: string | null;
  bio?: string | null;
  dashboardTheme?: string;
  profileVisibility?: string;
  allowFriendRequests?: boolean;
  showSavedOnProfile?: boolean;
}

/** Session plus the NavUser shape the top navigation needs. */
export async function sessionWithNav() {
  const session = await getSession();
  if (!session) return { session: null, navUser: null as NavUser | null };
  const u = session.user as typeof session.user & SessionProfileFields;
  const navUser: NavUser = {
    name: u.name,
    username: u.username ?? null,
    avatarImageId: u.avatarImageId ?? null,
    dashboardTheme: u.dashboardTheme,
  };
  return { session, navUser };
}

/** Everything the AppShell needs: user, sidebar pins, unread notifications. */
export async function shellData() {
  const { session, navUser } = await sessionWithNav();
  if (!session || !navUser) {
    return {
      session: null,
      navUser: null as NavUser | null,
      pins: [] as SidebarPin[],
      unread: 0,
    };
  }
  const [own, saved, myPlaylists, unread] = await Promise.all([
    listSeriesForOwner(session.user.id),
    listSaved(session.user.id),
    listPlaylistsForOwner(session.user.id),
    unreadCount(session.user.id),
  ]);
  const savedSeriesIds = saved
    .filter((s) => s.kind === "series")
    .map((s) => s.id);
  const [ownSeriesArt, savedSeriesArt, savedJournalArt, playlistArt] =
    await Promise.all([
      seriesCovers(own.map((s) => s.id)),
      seriesCovers(savedSeriesIds),
      journalCovers(
        saved.filter((s) => s.kind === "journal").map((s) => s.id)
      ),
      playlistCovers(myPlaylists.map((p) => p.id)),
    ]);
  const imageUrl = (id: string | undefined) =>
    id ? `/api/images/${id}` : null;

  const pins: SidebarPin[] = [
    ...myPlaylists.map((p) => ({
      key: `pl:${p.id}`,
      label: p.name,
      href: `/playlists/${p.id}`,
      icon: p.icon,
      imageUrl: imageUrl(playlistArt.get(p.id)),
      pinKind: "playlist" as const,
      itemKind: "journal" as const,
      itemId: p.id,
    })),
    ...own.map((s) => ({
      key: `own:${s.id}`,
      label: s.name,
      href: `/series/${s.slug}`,
      icon: s.icon,
      imageUrl: imageUrl(ownSeriesArt.get(s.id)),
      pinKind: "series" as const,
      itemKind: "series" as const,
      itemId: s.id,
    })),
    ...saved.map((s) => ({
      key: `saved:${s.kind}:${s.id}`,
      label: s.title,
      href: s.kind === "series" ? `/series/${s.slug}` : `/book/${s.slug}`,
      icon: s.icon,
      imageUrl: imageUrl(
        s.kind === "series"
          ? savedSeriesArt.get(s.id)
          : savedJournalArt.get(s.id)
      ),
      pinKind: "saved" as const,
      itemKind: s.kind,
      itemId: s.id,
    })),
  ];
  return { session, navUser, pins, unread };
}

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof sessionWithNav>>["session"]
>["user"] &
  SessionProfileFields;
