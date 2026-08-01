import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listJournalsForOwner } from "@/lib/journals";
import { JournalCard } from "@/components/dashboard/JournalCard";
import { SignOutButton } from "@/components/dashboard/SignOutButton";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const journals = await listJournalsForOwner(session.user.id);

  return (
    <main className="arcane-bg min-h-screen">
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        <header className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="font-display text-xl text-arcane-bright">
              Arcadia Vellum
            </Link>
            <p className="text-sm text-ink-dim">
              {session.user.name}&apos;s library
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/journal/new" className="btn-arcane">
              + New Journal
            </Link>
            <SignOutButton />
          </div>
        </header>

        {journals.length === 0 ? (
          <div className="panel-arcane p-12 text-center">
            <p className="font-heading text-xl mb-2">The shelves are bare.</p>
            <p className="text-ink-dim mb-6">
              Bind your first journal from a Google Doc or an uploaded file.
            </p>
            <Link href="/journal/new" className="btn-arcane">
              Bind a Journal
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {journals.map((j) => (
              <JournalCard key={j.id} journal={j} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
