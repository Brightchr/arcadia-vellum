import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isUserBanned } from "@/lib/profile";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { accessibleJournalIds } from "@/lib/access";
import { getSeriesBySlug, listVolumes } from "@/lib/series";
import { listTracks, entryCoverUrls, volumeCoverText } from "@/lib/audio";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { AudiobookPlayer } from "@/components/book/AudiobookPlayer";
import { ArrowLeftIcon, BookOpenIcon } from "@/components/icons";
import { volumeLabel } from "@/lib/volume";
import { resolveTheme } from "@/lib/custom-themes";
import { ThemeStyle } from "@/components/book/ThemeStyle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSeriesBySlug(slug);
  return {
    title: s ? `${s.name} (Audiobook) — Vellum` : "Vellum",
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
  if (!isOwner && (await isUserBanned(s.ownerId))) notFound();
  const allVolumes = await listVolumes(s.id);
  const accessible = await accessibleJournalIds(
    session?.user.id ?? null,
    allVolumes
  );
  const volumes = allVolumes.filter((v) => accessible.has(v.id));
  if (volumes.length === 0) notFound();

  if (session) {
    await recordActivity(session.user.id, "series", s.id, "listen");
  }

  const trackList = [];
  for (const v of volumes) {
    if (v.sourceType !== "audio") continue; // only audiobook volumes play
    const tracks = await listTracks(v.id);
    const vl = volumeLabel(v);
    const label = vl !== null ? `Vol. ${vl}` : v.title;
    const covers = entryCoverUrls(tracks, v.coverImageId);
    const volCoverUrl = v.coverImageId ? `/api/images/${v.coverImageId}` : null;
    const coverText = volumeCoverText(v);
    trackList.push(
      ...tracks.map((t, i) => ({
        id: t.id,
        title: tracks.length === 1 ? label : `${label} · Part ${i + 1}`,
        coverUrl: covers[i],
        coverText: volCoverUrl && covers[i] === volCoverUrl ? coverText : null,
        segmentIds: t.segmentIds,
      }))
    );
  }
  if (trackList.length === 0) notFound();

  const theme = await resolveTheme(volumes[0].theme);
  const author = volumes.find((v) => v.author)?.author ?? null;

  return (
    <main
      className={`${theme.className} tome-scene arcane-bg h-dvh overflow-hidden w-full relative flex flex-col`}
    >
      <ThemeStyle css={theme.css} />
      <TomeAmbience />
      <header className="relative z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href={isOwner ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1.5 text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          <ArrowLeftIcon /> {isOwner ? "Library" : "Vellum"}
        </Link>
        <Link
          href={`/s/${s.slug}`}
          className="inline-flex items-center gap-1.5 text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          <BookOpenIcon /> Read instead
        </Link>
      </header>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col w-full max-w-xl mx-auto px-4 pb-8 pt-2">
        <AudiobookPlayer
          tracks={trackList}
          title={s.name}
          author={author}
          storageKey={`av-listen-series-${s.id}`}
          fallbackArt={
            <div className="w-full h-full shadow-2xl shadow-black/60">
              <div className="tome-cover">
                <div className="tome-cover-ornament tome-cover-ornament--front" />
                <h1 className="tome-cover-title !text-[clamp(1rem,calc(var(--art,13rem)*0.08),2.4rem)]">
                  {s.name}
                </h1>
                <hr className="tome-cover-rule" />
                <p className="tome-cover-subtitle !text-[clamp(0.6rem,calc(var(--art,13rem)*0.034),1.05rem)]">
                  The complete chronicle in {volumes.length} volume
                  {volumes.length === 1 ? "" : "s"}
                </p>
                {author && (
                  <p className="tome-cover-author !bottom-[calc(var(--art,13rem)*0.09)] !text-[clamp(0.6rem,calc(var(--art,13rem)*0.034),1.05rem)]">
                    {author}
                  </p>
                )}
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
