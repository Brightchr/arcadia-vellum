import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession, googleConfigured } from "@/lib/auth";
import { getOwnedJournal } from "@/lib/journals";
import { SettingsForm } from "@/components/settings/SettingsForm";

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

  return (
    <main className="arcane-bg min-h-screen">
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-ink-dim hover:text-arcane-bright"
            >
              ← Library
            </Link>
            <h1 className="font-display text-2xl mt-1">{journal.title}</h1>
          </div>
          <Link href={`/j/${journal.slug}`} className="btn-arcane">
            Open Tome
          </Link>
        </header>
        <SettingsForm journal={journal} googleEnabled={googleConfigured} />
      </div>
    </main>
  );
}
