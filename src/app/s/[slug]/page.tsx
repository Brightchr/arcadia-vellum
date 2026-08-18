import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isUserBanned } from "@/lib/profile";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { accessibleJournalIds } from "@/lib/access";
import { getSeriesBySlug, listVolumes } from "@/lib/series";
import { getJournalContent } from "@/lib/journals";
import { autoSyncIfStale } from "@/lib/google/sync";
import { listTracks } from "@/lib/audio";
import TomeReader from "@/components/book/TomeReaderClient";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { ArrowLeftIcon, HeadphonesIcon } from "@/components/icons";
import { volumeLabel } from "@/lib/volume";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeriesBySlug(slug);
  return {
    title: s ? `${s.name} — Vellum` : "Vellum",
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
  if (!isOwner && (await isUserBanned(s.ownerId))) notFound();

  const allVolumes = await listVolumes(s.id);
  const accessible = await accessibleJournalIds(
    session?.user.id ?? null,
    allVolumes
  );
  const volumes = allVolumes.filter((v) => accessible.has(v.id));
  if (volumes.length === 0) notFound();

  // Audiobook volumes have no pages — an all-audio series goes straight to
  // its playlist, and a mixed series reads in its written volumes' binding.
  const written = volumes.filter((v) => v.sourceType !== "audio");
  if (written.length === 0) redirect(`/s/${s.slug}/listen`);

  if (isOwner) {
    for (const v of written) await autoSyncIfStale(v);
  }

  if (session) {
    await recordActivity(session.user.id, "series", s.id, "read");
  }

  // Fetch every volume's content concurrently — serial loads made long
  // series pay one round-trip per volume before the page could render.
  const contents = await Promise.all(written.map((v) => getJournalContent(v.id)));
  const parts: string[] = [];
  for (let i = 0; i < written.length; i++) {
    const v = written[i];
    const label = volumeLabel(v);
    const prefix = label !== null ? `Volume ${label} — ` : "";
    parts.push(`<h1>${escapeHtml(`${prefix}${v.title}`)}</h1>`);
    if (v.subtitle) {
      parts.push(`<p><em>${escapeHtml(v.subtitle)}</em></p>`);
    }
    if (contents[i]?.html) parts.push(contents[i]!.html);
  }

  const theme = written[0].theme;
  const author = written.find((v) => v.author)?.author ?? null;

  // The series has an audiobook side if any audio-only volume has tracks.
  let hasAudio = false;
  for (const v of volumes) {
    if (v.sourceType !== "audio") continue;
    if ((await listTracks(v.id)).length > 0) {
      hasAudio = true;
      break;
    }
  }

  return (
    <main
      className={`theme-${theme} tome-scene arcane-bg h-dvh w-full overflow-hidden relative`}
    >
      <TomeAmbience />
      <header className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href={isOwner ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1.5 text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          <ArrowLeftIcon /> {isOwner ? "Library" : "Vellum"}
        </Link>
        <div className="flex items-center gap-4">
          {hasAudio && (
            <Link
              href={`/s/${s.slug}/listen`}
              className="inline-flex items-center gap-1.5 text-ink-dim hover:text-arcane-bright transition font-heading"
            >
              <HeadphonesIcon /> Audiobook
            </Link>
          )}
          <span className="text-ink-dim font-heading">
            {written.length} volume{written.length === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <div className="h-full w-full pt-10 pb-2 relative z-10">
        <TomeReader
          html={parts.join("\n")}
          theme={theme}
          title={s.name}
          subtitle={`The complete chronicle in ${written.length} volume${written.length === 1 ? "" : "s"}`}
          author={author}
        />
      </div>
    </main>
  );
}
