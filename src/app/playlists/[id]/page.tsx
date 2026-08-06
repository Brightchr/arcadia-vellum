import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import {
  getOwnedPlaylist,
  listPlaylistItems,
  addableAudiobooks,
} from "@/lib/playlists";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { PlaylistEditor } from "@/components/playlists/PlaylistEditor";
import { PlaylistTitleControls } from "@/components/playlists/PlaylistTitleControls";
import { HeadphonesIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Playlist — Arcadia Vellum",
};

export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");

  const { id } = await params;
  const playlist = await getOwnedPlaylist(id, session.user.id);
  if (!playlist) notFound();

  const [items, addable] = await Promise.all([
    listPlaylistItems(id, session.user.id),
    addableAudiobooks(session.user.id),
  ]);
  const playableCount = items.filter((i) => i.playable).length;

  return (
    <main
      className={`${appThemeClass(navUser.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
        <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="min-w-0">
              <p className="text-[11px] font-heading uppercase tracking-widest text-ink-dim">
                Playlist
              </p>
              <PlaylistTitleControls
                playlistId={playlist.id}
                name={playlist.name}
              />
              <p className="text-sm text-ink-dim mt-1">
                {items.length} audiobook{items.length === 1 ? "" : "s"} — drag
                to set the listening order.
              </p>
            </div>
            {playableCount > 0 && (
              <Link
                href={`/playlists/${playlist.id}/listen`}
                className="btn-arcane"
              >
                <HeadphonesIcon /> Play
              </Link>
            )}
          </header>

          <div className="panel-arcane p-5">
            <PlaylistEditor
              playlistId={playlist.id}
              items={items}
              addable={addable.map((a) => ({ id: a.id, title: a.title }))}
            />
          </div>
        </div>
      </AppShell>
    </main>
  );
}
