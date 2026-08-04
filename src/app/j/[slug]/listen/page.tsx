import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getJournalBySlug } from "@/lib/journals";
import { listTracks } from "@/lib/audio";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { AudiobookPlayer } from "@/components/book/AudiobookPlayer";

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

  const tracks = await listTracks(journal.id);
  // Owners see a hint instead of a 404 so an empty audio-only tome isn't a
  // dead end.
  if (tracks.length === 0 && !isOwner) notFound();

  return (
    <main
      className={`theme-${journal.theme} tome-scene arcane-bg min-h-dvh w-full relative`}
    >
      <TomeAmbience />
      <header className="relative z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href={isOwner ? "/dashboard" : "/"}
          className="text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          ← {isOwner ? "Library" : "Arcadia Vellum"}
        </Link>
        {journal.sourceType !== "audio" && (
          <Link
            href={`/j/${journal.slug}`}
            className="text-ink-dim hover:text-arcane-bright transition font-heading"
          >
            📖 Read instead
          </Link>
        )}
      </header>

      <div className="relative z-10 max-w-md mx-auto px-4 pb-10 pt-2 space-y-6">
        {/* Cover as album art */}
        <div className="w-56 h-80 mx-auto shadow-2xl shadow-black/60">
          <div className="tome-cover !p-6">
            <div className="tome-cover-ornament tome-cover-ornament--front" />
            <h1 className="tome-cover-title !text-xl">{journal.title}</h1>
            <hr className="tome-cover-rule" />
            {journal.subtitle && (
              <p className="tome-cover-subtitle !text-xs">{journal.subtitle}</p>
            )}
            {journal.author && (
              <p className="tome-cover-author !bottom-8 !text-xs">
                {journal.author}
              </p>
            )}
            <div className="tome-cover-runes !bottom-4">ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ</div>
          </div>
        </div>

        {tracks.length > 0 ? (
          <AudiobookPlayer
            tracks={tracks.map((t) => ({ id: t.id, title: t.title }))}
            title={journal.title}
            author={journal.author}
            storageKey={`av-listen-${journal.id}`}
          />
        ) : (
          <div className="panel-arcane p-6 text-center space-y-3">
            <p className="text-sm text-ink-dim">
              No narration yet — this tome is silent until you add audio.
            </p>
            <Link
              href={`/journal/${journal.id}/settings#narration`}
              className="btn-arcane text-sm"
            >
              🎧 Add Narration
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
