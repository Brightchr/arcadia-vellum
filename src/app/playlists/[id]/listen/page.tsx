import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getViewablePlaylist, listPlaylistItems } from "@/lib/playlists";
import { getJournalById } from "@/lib/journals";
import { listTracks, entryCoverUrls, volumeCoverText } from "@/lib/audio";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { AudiobookPlayer } from "@/components/book/AudiobookPlayer";
import { ArrowLeftIcon } from "@/components/icons";
import { resolveTheme } from "@/lib/custom-themes";
import { ThemeStyle } from "@/components/book/ThemeStyle";

export const metadata: Metadata = {
  title: "Playlist — Vellum",
};

/** Plays a playlist's audiobooks back-to-back in the user's chosen order. */
export default async function PlaylistListenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const viewerId = session?.user.id ?? null;

  const { id } = await params;
  const playlist = await getViewablePlaylist(id, viewerId);
  if (!playlist) notFound();

  const items = (await listPlaylistItems(id, viewerId)).filter(
    (i) => i.playable
  );
  if (items.length === 0) redirect(`/playlists/${id}`);

  const trackList = [];
  let themeValue = "witch-grimoire";
  for (const [idx, item] of items.entries()) {
    const journal = await getJournalById(item.journalId);
    if (!journal) continue;
    if (idx === 0) themeValue = journal.theme;
    const tracks = await listTracks(journal.id);
    const covers = entryCoverUrls(tracks, journal.coverImageId);
    const volCoverUrl = journal.coverImageId
      ? `/api/images/${journal.coverImageId}`
      : null;
    const coverText = volumeCoverText(journal);
    trackList.push(
      ...tracks.map((t, i) => ({
        id: t.id,
        title:
          tracks.length === 1
            ? journal.title
            : `${journal.title} · Part ${i + 1}`,
        coverUrl: covers[i],
        coverText: volCoverUrl && covers[i] === volCoverUrl ? coverText : null,
        segmentIds: t.segmentIds,
      }))
    );
  }
  if (trackList.length === 0) redirect(`/playlists/${id}`);

  const theme = await resolveTheme(themeValue);

  return (
    <main
      className={`${theme.className} tome-scene arcane-bg h-dvh overflow-hidden w-full relative flex flex-col`}
    >
      <ThemeStyle css={theme.css} />
      <TomeAmbience />
      <header className="relative z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href={`/playlists/${playlist.id}`}
          className="inline-flex items-center gap-1.5 text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          <ArrowLeftIcon /> {playlist.name}
        </Link>
      </header>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col w-full max-w-xl mx-auto px-4 pb-8 pt-2">
        <AudiobookPlayer
          tracks={trackList}
          title={playlist.name}
          author={null}
          storageKey={`av-playlist-${playlist.id}`}
          fallbackArt={
            <div className="w-full h-full shadow-2xl shadow-black/60">
              <div className="tome-cover">
                <div className="tome-cover-ornament tome-cover-ornament--front" />
                <h1 className="tome-cover-title !text-[clamp(1rem,calc(var(--art,13rem)*0.08),2.4rem)]">
                  {playlist.name}
                </h1>
                <hr className="tome-cover-rule" />
                <p className="tome-cover-subtitle !text-[clamp(0.6rem,calc(var(--art,13rem)*0.034),1.05rem)]">
                  A playlist of {items.length} audiobook
                  {items.length === 1 ? "" : "s"}
                </p>
                <div className="tome-cover-runes !bottom-[calc(var(--art,13rem)*0.04)]">
                  ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ
                </div>
              </div>
            </div>
          }
        />
      </div>
    </main>
  );
}
