import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { getOwnedJournal, getJournalContent } from "@/lib/journals";
import { appThemeClass } from "@/lib/themes";
import { WriteEditor } from "@/components/editor/WriteEditor";
import { ArrowLeftIcon, BookOpenIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Write — Vellum",
};

export default async function WritePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const journal = await getOwnedJournal(id, session.user.id);
  if (!journal) notFound();
  if (journal.sourceType !== "write") redirect(`/journal/${id}/settings`);

  const content = await getJournalContent(id);
  const theme = (session.user as { dashboardTheme?: string }).dashboardTheme;

  return (
    <main className={`${appThemeClass(theme)} arcane-bg min-h-screen`}>
      <div className="max-w-4xl mx-auto p-6 md:p-10">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-arcane-bright"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" /> Library
            </Link>
            <h1 className="font-display text-2xl mt-1 truncate">
              {journal.title}
            </h1>
          </div>
          <Link href={`/j/${journal.slug}`} className="btn-ghost shrink-0">
            <BookOpenIcon /> Open Tome
          </Link>
        </header>
        <WriteEditor
          journalId={journal.id}
          initialMarkdown={content?.sourceMd ?? ""}
        />
      </div>
    </main>
  );
}
