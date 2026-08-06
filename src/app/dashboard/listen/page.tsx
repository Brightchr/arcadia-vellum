import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { listJournalsForOwner } from "@/lib/journals";
import { listTracks, entryCoverUrls } from "@/lib/audio";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { AudiobookPlayer } from "@/components/book/AudiobookPlayer";
import { ArrowLeftIcon, HeadphonesIcon } from "@/components/icons";
import { compareVolumes, volumeLabel } from "@/lib/volume";

export const metadata: Metadata = {
  title: "Your Audiobooks — Arcadia Vellum",
};

/** Every audiobook on the shelf, bound into one continuous playlist. */
export default async function AllAudiobooksListenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const audiobooks = (await listJournalsForOwner(session.user.id))
    .filter((j) => j.sourceType === "audio")
    .sort(compareVolumes);
  if (audiobooks.length === 0) redirect("/dashboard");

  const playlist = [];
  for (const j of audiobooks) {
    const tracks = await listTracks(j.id);
    const vl = volumeLabel(j);
    const label = vl !== null ? `${j.title} Vol. ${vl}` : j.title;
    const covers = entryCoverUrls(tracks, j.coverImageId);
    playlist.push(
      ...tracks.map((t, i) => ({
        id: t.id,
        title: tracks.length === 1 ? label : `${label} · Part ${i + 1}`,
        coverUrl: covers[i],
        segmentIds: t.segmentIds,
      }))
    );
  }

  const theme = audiobooks[0].theme;
  const author = audiobooks.find((j) => j.author)?.author ?? null;

  return (
    <main
      className={`theme-${theme} tome-scene arcane-bg min-h-dvh w-full relative flex flex-col`}
    >
      <TomeAmbience />
      <header className="relative z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          <ArrowLeftIcon /> Library
        </Link>
      </header>

      <div className="relative z-10 flex-1 flex flex-col w-full max-w-xl mx-auto px-4 pb-8 pt-2">
        <div className="text-center">
          <h1 className="font-display text-2xl text-arcane-bright inline-flex items-center gap-2.5">
            <HeadphonesIcon className="h-6 w-6" /> Your Audiobooks
          </h1>
          <p className="text-sm text-ink-dim mt-1">
            {audiobooks.length} tome{audiobooks.length === 1 ? "" : "s"}, played
            in shelf order.
          </p>
        </div>

        {playlist.length > 0 ? (
          <AudiobookPlayer
            tracks={playlist}
            title="Your Audiobooks"
            author={author}
            storageKey={`av-listen-all-${session.user.id}`}
          />
        ) : (
          <div className="panel-arcane p-6 text-center mt-auto">
            <p className="text-sm text-ink-dim">
              Your audiobooks have no narration tracks yet.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
