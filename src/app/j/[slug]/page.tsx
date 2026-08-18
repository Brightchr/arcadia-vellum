import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { isUserBanned } from "@/lib/profile";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { recordView } from "@/lib/analytics";
import { canAccessJournal, isDiscoverable } from "@/lib/access";
import { getJournalBySlug, getJournalContent } from "@/lib/journals";
import { autoSyncIfStale } from "@/lib/google/sync";
import TomeReader from "@/components/book/TomeReaderClient";
import { parseCoverLayout } from "@/lib/cover-layout";
import { resolveTheme } from "@/lib/custom-themes";
import { ThemeStyle } from "@/components/book/ThemeStyle";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import { ArrowLeftIcon } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const journal = await getJournalBySlug(slug);
  return {
    title: journal ? `${journal.title} — Vellum` : "Vellum",
  };
}

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const journal = await getJournalBySlug(slug);
  if (!journal) notFound();

  const session = await getSession();
  const isOwner = session?.user.id === journal.ownerId;
  if (!isOwner && (await isUserBanned(journal.ownerId))) notFound();
  if (!isOwner) {
    const allowed = await canAccessJournal(session?.user.id ?? null, journal);
    if (!allowed) {
      // Gated-but-visible works bounce to their teaser homepage; unlisted
      // works without a share link stay invisible.
      if (
        journal.listed &&
        (isDiscoverable(journal.visibility) || journal.visibility === "friends")
      ) {
        redirect(`/book/${journal.slug}`);
      }
      notFound();
    }
  }

  // Audio-only tomes have no pages to read — go straight to the player.
  if (journal.sourceType === "audio") redirect(`/j/${journal.slug}/listen`);

  // Keep the owner's view fresh without blocking readers on Google errors.
  if (isOwner) await autoSyncIfStale(journal);

  // Both writes land after the response is sent — never on the render path.
  const viewerId = session?.user.id ?? null;
  after(async () => {
    if (viewerId) {
      await recordActivity(viewerId, "journal", journal.id, "read");
    }
    await recordView(journal.id, journal.ownerId, viewerId);
  });

  const content = await getJournalContent(journal.id);
  const theme = await resolveTheme(journal.theme);

  return (
    <main
      className={`${theme.className} tome-scene arcane-bg h-dvh w-full overflow-hidden relative`}
    >
      <ThemeStyle css={theme.css} />
      <TomeAmbience />
      <header className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href={isOwner ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1.5 text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          <ArrowLeftIcon /> {isOwner ? "Library" : "Vellum"}
        </Link>
        <div className="flex items-center gap-4">
          {isOwner && (
            <Link
              href={`/journal/${journal.id}/settings`}
              className="text-ink-dim hover:text-arcane-bright transition font-heading"
            >
              Settings
            </Link>
          )}
        </div>
      </header>

      <div className="h-full w-full pt-10 pb-2 relative z-10">
        <TomeReader
          html={content?.html ?? ""}
          theme={theme.className.replace(/^theme-/, "")}
          title={journal.title}
          subtitle={journal.subtitle}
          author={journal.author}
          coverUrl={
            journal.coverImageId ? `/api/images/${journal.coverImageId}` : null
          }
          coverLayout={parseCoverLayout(journal.coverLayout)}
        />
      </div>
    </main>
  );
}
