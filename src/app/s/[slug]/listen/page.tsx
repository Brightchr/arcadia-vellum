import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getSeriesBySlug, listVolumes } from "@/lib/series";
import { listTracks } from "@/lib/audio";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { AudiobookPlayer } from "@/components/book/AudiobookPlayer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeriesBySlug(slug);
  return {
    title: s ? `${s.name} (Audiobook) — Arcadia Vellum` : "Arcadia Vellum",
  };
}

export default async function SeriesListenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await getSeriesBySlug(slug);
  if (!s) notFound();

  const session = await getSession();
  const isOwner = session?.user.id === s.ownerId;
  const volumes = (await listVolumes(s.id)).filter(
    (v) => isOwner || v.visibility === "public"
  );
  if (volumes.length === 0) notFound();

  const trackList = [];
  for (const v of volumes) {
    const tracks = await listTracks(v.id);
    trackList.push(
      ...tracks.map((t) => ({
        id: t.id,
        title:
          v.volumeNumber !== null
            ? `Vol. ${v.volumeNumber} — ${t.title}`
            : t.title,
      }))
    );
  }
  if (trackList.length === 0) notFound();

  const theme = volumes[0].theme;
  const author = volumes.find((v) => v.author)?.author ?? null;

  return (
    <main
      className={`theme-${theme} tome-scene arcane-bg min-h-dvh w-full relative`}
    >
      <TomeAmbience />
      <header className="relative z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href={isOwner ? "/dashboard" : "/"}
          className="text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          ← {isOwner ? "Library" : "Arcadia Vellum"}
        </Link>
        <Link
          href={`/s/${s.slug}`}
          className="text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          📖 Read instead
        </Link>
      </header>

      <div className="relative z-10 max-w-md mx-auto px-4 pb-10 pt-2 space-y-6">
        <div className="w-56 h-80 mx-auto shadow-2xl shadow-black/60">
          <div className="tome-cover !p-6">
            <div className="tome-cover-ornament tome-cover-ornament--front" />
            <h1 className="tome-cover-title !text-xl">{s.name}</h1>
            <hr className="tome-cover-rule" />
            <p className="tome-cover-subtitle !text-xs">
              The complete chronicle in {volumes.length} volume
              {volumes.length === 1 ? "" : "s"}
            </p>
            {author && (
              <p className="tome-cover-author !bottom-8 !text-xs">{author}</p>
            )}
            <div className="tome-cover-runes !bottom-4">ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ</div>
          </div>
        </div>

        <AudiobookPlayer
          tracks={trackList}
          title={s.name}
          author={author}
          storageKey={`av-listen-series-${s.id}`}
        />
      </div>
    </main>
  );
}
