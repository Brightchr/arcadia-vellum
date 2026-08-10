import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, googleConfigured } from "@/lib/auth";
import { getOwnedJournal } from "@/lib/journals";
import { listSeriesForOwner } from "@/lib/series";
import { listTracks } from "@/lib/audio";
import { listJournalTags } from "@/lib/tags";
import { appThemeClass } from "@/lib/themes";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { ArrowLeftIcon } from "@/components/icons";
import {
  customThemeCss,
  listThemesForOwner,
  parseThemeConfig,
} from "@/lib/custom-themes";
import { ThemeStyle } from "@/components/book/ThemeStyle";

export default async function JournalSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) notFound();

  const theme = (session.user as { dashboardTheme?: string }).dashboardTheme;
  const allSeries = await listSeriesForOwner(session.user.id);
  const currentSeries =
    allSeries.find((s) => s.id === journal.seriesId)?.name ?? "";
  const tracks = await listTracks(journal.id);
  const tagNames = await listJournalTags(journal.id);

  // Custom themes appear in the picker; their generated CSS must be on the
  // page for the mini previews to render.
  const customThemes = await listThemesForOwner(session.user.id);
  const customCss = customThemes
    .map((t) => {
      const config = parseThemeConfig(t.config);
      return config ? customThemeCss(`theme-custom-${t.id}`, config) : "";
    })
    .filter(Boolean)
    .join("\n");

  return (
    <main className={`${appThemeClass(theme)} arcane-bg min-h-screen`}>
      <ThemeStyle css={customCss || null} />
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-arcane-bright"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" /> Library
            </Link>
            <h1 className="font-display text-2xl mt-1">{journal.title}</h1>
          </div>
          <Link href={`/j/${journal.slug}`} className="btn-arcane">
            Open Tome
          </Link>
        </header>
        <SettingsForm
          journal={journal}
          googleEnabled={googleConfigured}
          seriesName={currentSeries}
          seriesNames={allSeries.map((s) => s.name)}
          tracks={tracks.map((t) => ({
            id: t.id,
            title: t.title,
            parts: t.segmentIds.length,
            coverImageId: t.coverImageId,
          }))}
          tagNames={tagNames}
          customThemes={customThemes.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>
    </main>
  );
}
