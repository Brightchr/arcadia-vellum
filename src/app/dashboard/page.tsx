import { redirect } from "next/navigation";
import Link from "next/link";
import { shellData } from "@/lib/nav";
import { listJournalsForOwner } from "@/lib/journals";
import { listSeriesForOwner } from "@/lib/series";
import { trackCountsForOwner } from "@/lib/audio";
import { listRecentActivity } from "@/lib/activity";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { LibraryShelves } from "@/components/dashboard/LibraryShelves";
import { WorkCover } from "@/components/discover/WorkCard";

export default async function DashboardPage() {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");
  if (!navUser.username) redirect("/welcome");

  const [journals, seriesList, trackCounts, recent] = await Promise.all([
    listJournalsForOwner(session.user.id),
    listSeriesForOwner(session.user.id),
    trackCountsForOwner(session.user.id),
    listRecentActivity(session.user.id),
  ]);
  const dashboardTheme = navUser.dashboardTheme ?? "";

  return (
    <main className={`${appThemeClass(dashboardTheme)} arcane-bg min-h-screen`}>
      <AppShell
        user={navUser}
        active="library"
        pins={pins}
        unreadNotifications={unread}
      >
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display text-2xl text-arcane-bright">
                Your Library
              </h1>
              <p className="text-sm text-ink-dim">
                {navUser.name}&apos;s tomes, shelves, and audiobooks.
              </p>
            </div>
            <Link href="/journal/new" className="btn-arcane md:hidden">
              + New Journal
            </Link>
          </header>

          {recent.length > 0 && (
            <section className="mb-8">
              <h2 className="font-heading text-lg mb-3">Jump back in</h2>
              <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
                {recent.map((a) => (
                  <Link
                    key={`${a.kind}:${a.itemId}`}
                    href={a.href}
                    className="group rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur p-2 hover:border-arcane/60 transition-colors"
                  >
                    <WorkCover
                      work={{
                        title: a.title,
                        author: null,
                        theme: a.theme,
                        coverImageId: a.coverImageId,
                      }}
                      className="mb-2 group-hover:opacity-95"
                    />
                    <p className="text-xs font-heading truncate">{a.title}</p>
                    <p className="text-[10px] text-ink-dim uppercase tracking-wider">
                      {a.mode === "listen" ? "Keep listening" : "Keep reading"}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

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
      </AppShell>
    </main>
  );
}
