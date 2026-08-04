import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listJournalsForOwner } from "@/lib/journals";
import { listSeriesForOwner } from "@/lib/series";
import { trackCountsForOwner } from "@/lib/audio";
import { appThemeClass } from "@/lib/themes";
import { LibraryShelves } from "@/components/dashboard/LibraryShelves";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { DashboardThemePicker } from "@/components/dashboard/DashboardThemePicker";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const journals = await listJournalsForOwner(session.user.id);
  const seriesList = await listSeriesForOwner(session.user.id);
  const trackCounts = await trackCountsForOwner(session.user.id);
  const dashboardTheme =
    (session.user as { dashboardTheme?: string }).dashboardTheme ?? "";

  return (
    <main className={`${appThemeClass(dashboardTheme)} arcane-bg min-h-screen`}>
      <div className="max-w-5xl mx-auto p-6 md:p-10">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 mb-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mark.png"
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-lg shadow shadow-black/40"
            />
            <div>
              <Link href="/" className="font-display text-xl text-arcane-bright">
                Arcadia Vellum
              </Link>
              <p className="text-sm text-ink-dim">
                {session.user.name}&apos;s library
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <DashboardThemePicker
              current={dashboardTheme || "witch-grimoire"}
            />
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
