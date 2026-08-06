import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity";
import { canAccessJournal, isDiscoverable } from "@/lib/access";
import { getJournalBySlug, getJournalContent } from "@/lib/journals";
import { autoSyncIfStale } from "@/lib/google/sync";
import TomeReader from "@/components/book/TomeReaderClient";
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
    title: journal ? `${journal.title} — Arcadia Vellum` : "Arcadia Vellum",
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
  if (journal.visibility !== "public" && !isOwner) {
    const allowed = await canAccessJournal(session?.user.id ?? null, journal);
    if (!allowed) {
      // Gated-but-visible works bounce to their teaser homepage.
      if (isDiscoverable(journal.visibility) || journal.visibility === "friends") {
        redirect(`/book/${journal.slug}`);
      }
      notFound();
    }
  }

  // Audio-only tomes have no pages to read — go straight to the player.
  if (journal.sourceType === "audio") redirect(`/j/${journal.slug}/listen`);

  // Keep the owner's view fresh without blocking readers on Google errors.
  if (isOwner) await autoSyncIfStale(journal);

  if (session) {
    await recordActivity(session.user.id, "journal", journal.id, "read");
  }

  const content = await getJournalContent(journal.id);

  return (
    <main
      className={`theme-${journal.theme} tome-scene arcane-bg h-dvh w-full overflow-hidden relative`}
    >
      <TomeAmbience />
      <header className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2 text-sm">
        <Link
          href={isOwner ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1.5 text-ink-dim hover:text-arcane-bright transition font-heading"
        >
          <ArrowLeftIcon /> {isOwner ? "Library" : "Arcadia Vellum"}
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
          theme={journal.theme}
          title={journal.title}
          subtitle={journal.subtitle}
          author={journal.author}
        />
      </div>
    </main>
  );
}
