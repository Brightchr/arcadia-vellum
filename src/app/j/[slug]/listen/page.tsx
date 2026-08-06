import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getJournalBySlug } from "@/lib/journals";
import { listTracks, entryCoverUrls } from "@/lib/audio";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { AudiobookPlayer } from "@/components/book/AudiobookPlayer";
import { ArrowLeftIcon, HeadphonesIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const journal = await getJournalBySlug(slug);
  return {
    title: journal
      ? `${journal.title} (Audiobook) — Arcadia Vellum`
      : "Arcadia Vellum",
  };
}

export default async function ListenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const journal = await getJournalBySlug(slug);
  if (!journal) notFound();

  const session = await getSession();
  const isOwner = session?.user.id === journal.ownerId;
  if (journal.visibility !== "public" && !isOwner) notFound();
  // Only audio-only tomes have a listening side.
  if (journal.sourceType !== "audio") notFound();

  const tracks = await listTracks(journal.id);
  // Owners see a hint instead of a 404 so an empty audio-only tome isn't a
  // dead end.
  if (tracks.length === 0 && !isOwner) notFound();

  // Chapter images: each entry's own image, falling back to the first set
  // one, then the volume cover.
  const covers = entryCoverUrls(tracks, journal.coverImageId);

  return (
    <main
      className={`theme-${journal.theme} tome-scene arcane-bg min-h-dvh w-full relative flex flex-col`}
    >
      <TomeAmbience />
      <header className="relative z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href={isOwner ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1.5 text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          <ArrowLeftIcon /> {isOwner ? "Library" : "Arcadia Vellum"}
        </Link>
      </header>

      <div className="relative z-10 flex-1 flex flex-col w-full max-w-xl mx-auto px-4 pb-8 pt-2">
        {tracks.length > 0 ? (
          <AudiobookPlayer
            tracks={tracks.map((t, i) => ({
              id: t.id,
              // Uploaded filenames make poor chapter names — label by part.
              title: tracks.length === 1 ? journal.title : `Part ${i + 1}`,
              coverUrl: covers[i],
              segmentIds: t.segmentIds,
            }))}
            title={journal.title}
            author={journal.author}
            storageKey={`av-listen-${journal.id}`}
            fallbackArt={
              <div className="w-full h-full shadow-2xl shadow-black/60">
                <div className="tome-cover !p-[calc(var(--art,13rem)*0.09)]">
                  <div className="tome-cover-ornament tome-cover-ornament--front" />
                  <h1 className="tome-cover-title !text-[clamp(1rem,calc(var(--art,13rem)*0.08),2.4rem)]">
                    {journal.title}
                  </h1>
                  <hr className="tome-cover-rule" />
                  {journal.subtitle && (
                    <p className="tome-cover-subtitle !text-[clamp(0.6rem,calc(var(--art,13rem)*0.034),1.05rem)]">
                      {journal.subtitle}
                    </p>
                  )}
                  {journal.author && (
                    <p className="tome-cover-author !bottom-[calc(var(--art,13rem)*0.09)] !text-[clamp(0.6rem,calc(var(--art,13rem)*0.034),1.05rem)]">
                      {journal.author}
                    </p>
                  )}
                  <div className="tome-cover-runes !bottom-[calc(var(--art,13rem)*0.04)]">
                    ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ
                  </div>
                </div>
              </div>
            }
          />
        ) : (
          <div className="panel-arcane p-6 text-center space-y-3 mt-auto">
            <p className="text-sm text-ink-dim">
              No narration yet — this tome is silent until you add audio.
            </p>
            <Link
              href={`/journal/${journal.id}/settings#narration`}
              className="btn-arcane"
            >
              <HeadphonesIcon /> Add Narration
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
