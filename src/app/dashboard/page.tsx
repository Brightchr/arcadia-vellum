import { redirect } from "next/navigation";
import Link from "next/link";
import { sessionWithNav } from "@/lib/nav";
import { listJournalsForOwner } from "@/lib/journals";
import { listSeriesForOwner } from "@/lib/series";
import { trackCountsForOwner } from "@/lib/audio";
import { appThemeClass } from "@/lib/themes";
import { AppNav } from "@/components/nav/AppNav";
import { LibraryShelves } from "@/components/dashboard/LibraryShelves";

export default async function DashboardPage() {
  const { session, navUser } = await sessionWithNav();
  if (!session || !navUser) redirect("/login");
  if (!navUser.username) redirect("/welcome");

  const journals = await listJournalsForOwner(session.user.id);
  const seriesList = await listSeriesForOwner(session.user.id);
  const trackCounts = await trackCountsForOwner(session.user.id);
  const dashboardTheme = navUser.dashboardTheme ?? "";

  return (
    <main className={`${appThemeClass(dashboardTheme)} arcane-bg min-h-screen`}>
      <AppNav user={navUser} active="library" />
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl text-arcane-bright">
              Your Library
            </h1>
            <p className="text-sm text-ink-dim">
              {navUser.name}&apos;s tomes, shelves, and audiobooks.
            </p>
          </div>
          <Link href="/journal/new" className="btn-arcane">
            + New Journal
          </Link>
        </header>

        {journals.length === 0 ? (
          <div className="panel-arcane p-12 text-center">
            <p className="font-heading text-xl mb-2">The shelves are bare.</p>
            <p className="text-ink-dim mb-6">
              Bind your first journal from a Google Doc, an uploaded file, the
              built-in editor, or audio files.
            </p>
            <Link href="/journal/new" className="btn-arcane">
              Bind a Journal
            </Link>
          </div>
        ) : (
          <LibraryShelves
            journals={journals}
            seriesList={seriesList}
            trackCounts={trackCounts}
          />
        )}
      </div>
    </main>
  );
}
