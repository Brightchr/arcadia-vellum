import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import { listJournalsForOwner } from "@/lib/journals";
import { listSeriesForOwner } from "@/lib/series";
import { trackCountsForOwner } from "@/lib/audio";
import { authorStats } from "@/lib/analytics";
import { friendsWithPresence } from "@/lib/presence";
import { Avatar } from "@/components/nav/Avatar";
import { Stars } from "@/components/discover/StarRating";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { LibraryShelves } from "@/components/dashboard/LibraryShelves";
import {
  ViewsAreaChart,
  ViewsByWorkBars,
} from "@/components/dashboard/ReaderCharts";
import { customThemeCssFor } from "@/lib/custom-themes";
import { ThemeStyle } from "@/components/book/ThemeStyle";

export const metadata: Metadata = {
  title: "Home — Vellum",
};

/** Home: the author's room — your works and the story of how they're doing. */
export default async function HomePage() {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");
  if (!navUser.username) redirect("/welcome");

  const [journals, seriesList, trackCounts, stats, friends] =
    await Promise.all([
      listJournalsForOwner(session.user.id),
      listSeriesForOwner(session.user.id),
      trackCountsForOwner(session.user.id),
      authorStats(session.user.id),
      friendsWithPresence(session.user.id),
    ]);
  const onlineFriends = friends.filter((f) => f.online);
  const dashboardTheme = navUser.dashboardTheme ?? "";
  const customCss = await customThemeCssFor(journals.map((j) => j.theme));

  const stat = (label: string, value: string | number) => (
    <div className="panel-arcane px-4 py-3">
      <p className="font-display text-xl text-arcane-bright">{value}</p>
      <p className="text-[11px] font-heading uppercase tracking-widest text-ink-dim">
        {label}
      </p>
    </div>
  );

  return (
    <main className={`${appThemeClass(dashboardTheme)} arcane-bg min-h-screen`}>
      <ThemeStyle css={customCss} />
      <AppShell
        user={navUser}
        active="library"
        pins={pins}
        unreadNotifications={unread}
      >
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl text-ink">
                Welcome back, {navUser.name.split(" ")[0]}
              </h1>
              <p className="text-sm text-ink-dim">
                Your works, and the readers finding them.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {onlineFriends.length > 0 && (
                <Link
                  href="/friends"
                  title={onlineFriends
                    .map((f) =>
                      f.activityLabel ? `${f.name} — ${f.activityLabel}` : f.name
                    )
                    .join("\n")}
                  className="lg:hidden flex items-center gap-2 rounded-full border border-edge bg-overlay py-1 pl-1.5 pr-3 transition-colors hover:bg-overlay-strong"
                >
                  <span className="flex -space-x-2">
                    {onlineFriends.slice(0, 4).map((f) => (
                      <Avatar
                        key={f.id}
                        name={f.name}
                        avatarImageId={f.avatarImageId}
                        size={24}
                      />
                    ))}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-ink-dim">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {onlineFriends.length} online
                  </span>
                </Link>
              )}
              <Link href="/journal/new" className="btn-arcane">
                + New Journal
              </Link>
            </div>
          </header>

          {/* The numbers at a glance */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stat("Works", journals.length)}
            {stat("Reading now", stats.currentReaders.length)}
            {stat("Reads · 28d", stats.views28)}
            {stat(
              "Avg rating",
              stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—"
            )}
            {stat("Shelved", stats.totalSaves)}
            {stat("Link opens", stats.shareOpens)}
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel-arcane p-5">
              <h2 className="font-heading text-lg mb-1">Reads per day</h2>
              <p className="text-xs text-ink-dim mb-4">
                Every time a reader opens one of your tomes, last 28 days.
              </p>
              <ViewsAreaChart data={stats.viewsByDay} />
            </section>
            <section className="panel-arcane p-5">
              <h2 className="font-heading text-lg mb-1">Reads by work</h2>
              <p className="text-xs text-ink-dim mb-4">
                All-time opens, your most-read tomes first.
              </p>
              {stats.viewsByWork.length === 0 ? (
                <p className="text-sm text-ink-dim italic">
                  No reads counted yet — they start the moment someone opens a
                  tome.
                </p>
              ) : (
                <ViewsByWorkBars data={stats.viewsByWork} />
              )}
            </section>
          </div>

          {/* Who's reading + what reviewers say */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel-arcane p-5">
              <h2 className="font-heading text-lg mb-3">Reading right now</h2>
              {stats.currentReaders.length === 0 ? (
                <p className="text-sm text-ink-dim italic">
                  Nobody has a tome of yours open at the moment.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {stats.currentReaders.map((r, i) => (
                    <li key={i} className="flex items-baseline gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0 translate-y-[-1px]" />
                      <span className="min-w-0">
                        <span className="font-heading">
                          {r.readerName ?? "A quiet reader"}
                        </span>{" "}
                        <span className="text-ink-dim">
                          is {r.mode === "listen" ? "listening to" : "reading"}{" "}
                          {r.workTitle}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel-arcane p-5">
              <h2 className="font-heading text-lg mb-3">Recent reviews</h2>
              {stats.recentReviews.length === 0 ? (
                <p className="text-sm text-ink-dim italic">
                  No reviews yet — publish to the Archives to gather some.
                </p>
              ) : (
                <ul className="space-y-3 max-h-72 overflow-y-auto pr-2">
                  {stats.recentReviews.map((r, i) => (
                    <li key={i} className="text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <Avatar
                          name={r.reviewerName}
                          avatarImageId={r.reviewerAvatarId}
                          size={20}
                        />
                        <span className="font-heading">{r.reviewerName}</span>
                        <Stars value={r.rating} size={12} />
                        <Link
                          href={`/book/${r.workSlug}`}
                          className="text-xs text-arcane-bright hover:underline truncate"
                        >
                          {r.workTitle}
                        </Link>
                      </span>
                      {r.body && (
                        <p className="text-ink-dim mt-0.5 line-clamp-2">
                          {r.body}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* The works themselves */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="font-heading text-lg">Your Library</h2>
            </div>
            {journals.length === 0 ? (
              <div className="panel-arcane p-12 text-center">
                <p className="font-heading text-xl mb-2">
                  The shelves are bare.
                </p>
                <p className="text-ink-dim mb-6">
                  Bind your first journal from a Google Doc, an uploaded file,
                  the built-in editor, or audio files.
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
          </section>
        </div>
      </AppShell>
    </main>
  );
}
