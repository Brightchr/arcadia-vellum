import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import {
  getViewablePlaylist,
  listPlaylistItems,
  addableAudiobooks,
} from "@/lib/playlists";
import { getUserById } from "@/lib/profile";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { PlaylistEditor } from "@/components/playlists/PlaylistEditor";
import { PlaylistTitleControls } from "@/components/playlists/PlaylistTitleControls";
import { PlaylistShareControl } from "@/components/playlists/PlaylistShareControl";
import { HeadphonesIcon, UsersIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Playlist — Vellum",
};

export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, navUser, pins, unread } = await shellData();
  const viewerId = session?.user.id ?? null;

  const { id } = await params;
  const playlist = await getViewablePlaylist(id, viewerId);
  if (!playlist) notFound();
  const isOwner = viewerId === playlist.ownerId;

  const [items, addable, owner] = await Promise.all([
    listPlaylistItems(id, viewerId),
    isOwner ? addableAudiobooks(playlist.ownerId) : Promise.resolve([]),
    isOwner ? Promise.resolve(null) : getUserById(playlist.ownerId),
  ]);
  const playableCount = items.filter((i) => i.playable).length;

  return (
    <main
      className={`${appThemeClass(navUser?.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
        <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="min-w-0">
              <p className="text-[11px] font-heading uppercase tracking-widest text-ink-dim">
                Playlist
                {!isOwner && playlist.visibility === "friends" && (
                  <span className="ml-2 inline-flex items-center gap-1 normal-case tracking-normal">
                    <UsersIcon className="h-3 w-3" /> shared with friends
                  </span>
                )}
              </p>
              {isOwner ? (
                <PlaylistTitleControls
                  playlistId={playlist.id}
                  name={playlist.name}
                />
              ) : (
                <h1 className="font-display text-2xl text-arcane-bright">
                  {playlist.name}
                </h1>
              )}
              <p className="text-sm text-ink-dim mt-1">
                {items.length} audiobook{items.length === 1 ? "" : "s"}
                {isOwner
                  ? " — drag to set the listening order."
                  : owner?.username
                    ? (
                        <>
                          {" · by "}
                          <Link
                            href={`/u/${owner.username}`}
                            className="text-arcane-bright hover:underline"
                          >
                            {owner.name}
                          </Link>
                        </>
                      )
                    : owner
                      ? ` · by ${owner.name}`
                      : null}
              </p>
              {isOwner && (
                <div className="mt-2">
                  <PlaylistShareControl
                    playlistId={playlist.id}
                    visibility={playlist.visibility}
                  />
                </div>
              )}
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
            {isOwner ? (
              <PlaylistEditor
                playlistId={playlist.id}
                items={items}
                addable={addable.map((a) => ({ id: a.id, title: a.title }))}
              />
            ) : items.length === 0 ? (
              <p className="text-sm text-ink-dim italic">
                This playlist is empty.
              </p>
            ) : (
              <ol className="space-y-1">
                {items.map((item, i) => (
                  <li
                    key={item.journalId}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md ${
                      item.playable ? "" : "opacity-50"
                    }`}
                  >
                    <span className="w-6 text-right text-xs font-heading text-ink-dim shrink-0">
                      {i + 1}.
                    </span>
                    {item.coverImageId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/images/${item.coverImageId}`}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover border border-edge shrink-0"
                      />
                    ) : (
                      <span className="h-10 w-10 rounded-md bg-overlay inline-flex items-center justify-center shrink-0">
                        <HeadphonesIcon className="h-4 w-4 text-ink-dim" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      {item.playable ? (
                        <Link
                          href={`/book/${item.slug}`}
                          className="text-sm truncate block hover:text-arcane-bright transition-colors"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <span
                          className="text-sm truncate block"
                          title="This work is no longer available"
                        >
                          {item.title}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </AppShell>
    </main>
  );
}
