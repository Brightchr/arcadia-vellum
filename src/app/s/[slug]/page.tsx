import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getSeriesBySlug, listVolumes } from "@/lib/series";
import { getJournalContent } from "@/lib/journals";
import { autoSyncIfStale } from "@/lib/google/sync";
import { listTracks } from "@/lib/audio";
import TomeReader from "@/components/book/TomeReaderClient";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { NarrationPlayer } from "@/components/book/NarrationPlayer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeriesBySlug(slug);
  return {
    title: s ? `${s.name} — Arcadia Vellum` : "Arcadia Vellum",
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** The whole series bound as one tome, a volume title page between volumes. */
export default async function SeriesReaderPage({
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

  if (isOwner) {
    for (const v of volumes) await autoSyncIfStale(v);
  }

  const parts: string[] = [];
  for (const v of volumes) {
    const content = await getJournalContent(v.id);
    const volumeLabel =
      v.volumeNumber !== null ? `Volume ${v.volumeNumber} — ` : "";
    parts.push(`<h1>${escapeHtml(`${volumeLabel}${v.title}`)}</h1>`);
    if (v.subtitle) {
      parts.push(`<p><em>${escapeHtml(v.subtitle)}</em></p>`);
    }
    if (content?.html) parts.push(content.html);
  }

  const theme = volumes[0].theme;
  const author = volumes.find((v) => v.author)?.author ?? null;

  // Combined playlist: every volume's narration tracks, in volume order.
  const trackLists = [];
  for (const v of volumes) {
    const tracks = await listTracks(v.id);
    trackLists.push(
      ...tracks.map((t) => ({
        id: t.id,
        title:
          volumes.length > 1 && v.volumeNumber !== null
            ? `Vol. ${v.volumeNumber} — ${t.title}`
            : t.title,
      }))
    );
  }

  return (
    <main
      className={`theme-${theme} tome-scene arcane-bg h-dvh w-full overflow-hidden relative`}
    >
      <TomeAmbience />
      <header className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href={isOwner ? "/dashboard" : "/"}
          className="text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          ← {isOwner ? "Library" : "Arcadia Vellum"}
        </Link>
        <div className="flex items-center gap-4">
          {trackLists.length > 0 && (
            <Link
              href={`/s/${s.slug}/listen`}
              className="text-ink-dim hover:text-arcane-bright transition font-heading"
            >
              🎧 Audiobook
            </Link>
          )}
          <span className="text-ink-dim font-heading">
            {volumes.length} volume{volumes.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <div className="h-full w-full pt-10 pb-2 relative z-10">
        <TomeReader
          html={parts.join("\n")}
          theme={theme}
          title={s.name}
          subtitle={`The complete chronicle in ${volumes.length} volume${volumes.length === 1 ? "" : "s"}`}
          author={author}
        />
      </div>

      <NarrationPlayer tracks={trackLists} />
    </main>
  );
}
