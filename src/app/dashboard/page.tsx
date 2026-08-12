import { redirect } from "next/navigation";
import Link from "next/link";
import { shellData } from "@/lib/nav";
import { listJournalsForOwner } from "@/lib/journals";
import { listSeriesForOwner } from "@/lib/series";
import { trackCountsForOwner } from "@/lib/audio";
import { listRecentActivity } from "@/lib/activity";
import { homeFeed } from "@/lib/recommendations";
import { friendsWithPresence } from "@/lib/presence";
import { Avatar } from "@/components/nav/Avatar";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { LibraryShelves } from "@/components/dashboard/LibraryShelves";
import { WorkCover } from "@/components/discover/WorkCard";
import { WorkRow } from "@/components/discover/WorkRow";
import { customThemeCssFor } from "@/lib/custom-themes";
import { ThemeStyle } from "@/components/book/ThemeStyle";

export default async function DashboardPage() {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");
  if (!navUser.username) redirect("/welcome");

  const [journals, seriesList, trackCounts, recent, feed, friends] =
    await Promise.all([
      listJournalsForOwner(session.user.id),
      listSeriesForOwner(session.user.id),
      trackCountsForOwner(session.user.id),
      listRecentActivity(session.user.id),
      homeFeed(session.user.id),
      friendsWithPresence(session.user.id),
    ]);
  const onlineFriends = friends.filter((f) => f.online);
  const dashboardTheme = navUser.dashboardTheme ?? "";

  // Custom-themed covers on this page need their generated CSS present.
  const customCss = await customThemeCssFor([
    ...recent.map((a) => a.theme),
    ...journals.map((j) => j.theme),
    ...[
      feed.followedNew,
      feed.friendsRecommend,
      feed.bestReviewed,
      feed.newAndNoteworthy,
      feed.popular,
    ]
      .flat()
      .map((w) => w.theme),
    ...feed.tagRows.flatMap((r) => r.works.map((w) => w.theme)),
  ]);

  return (
    <main className={`${appThemeClass(dashboardTheme)} arcane-bg min-h-screen`}>
      <ThemeStyle css={customCss} />
      <AppShell
        user={navUser}
        active="library"
        pins={pins}
        unreadNotifications={unread}
      >
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8 space-y-10">
          <header className="flex flex-wrap items-center justify-between gap-4 !mb-0">
            <div>
              <h1 className="font-display text-2xl text-ink">
                Welcome back, {navUser.name.split(" ")[0]}
              </h1>
              <p className="text-sm text-ink-dim">
                Your library, your follows, and tomes worth discovering.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Steam-style glance: who's on right now */}
              {/* The xl+ social rail shows this; the pill covers smaller screens */}
              {onlineFriends.length > 0 && (
                <Link
                  href="/friends"
                  title={onlineFriends
                    .map((f) => f.activityLabel ? `${f.name} — ${f.activityLabel}` : f.name)
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
              <Link href="/journal/new" className="btn-arcane md:hidden">
                + New Journal
              </Link>
            </div>
          </header>

          {recent.length > 0 && (
            <section>
              <h2 className="font-heading text-lg mb-3">Jump back in</h2>
              <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
                {recent.map((a) => (
                  <Link
                    key={`${a.kind}:${a.itemId}`}
                    href={a.href}
                    className="group rounded-xl border border-edge bg-overlay backdrop-blur p-2 hover:border-arcane/60 transition-colors"
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

          <WorkRow
            dismissable
            title="New from your follows"
            subtitle="Fresh releases from scribes and series you follow."
            works={feed.followedNew}
          />
          <WorkRow
            dismissable
            title="Friends recommend"
            subtitle="Saved or loved by your friends."
            works={feed.friendsRecommend}
          />
          {feed.tagRows.map((row) => (
            <WorkRow
            dismissable
              key={row.tag}
              title={`Because you liked "${row.tag}"`}
              works={row.works}
              showAllHref={`/browse?tag=${encodeURIComponent(row.tag)}`}
            />
          ))}
          <WorkRow
            dismissable
            title="Best reviewed"
            subtitle="The community's highest-rated tomes."
            works={feed.bestReviewed}
            showAllHref="/browse?sort=top"
          />
          <WorkRow
            dismissable
            title="New & noteworthy"
            subtitle="The latest additions to the archives."
            works={feed.newAndNoteworthy}
            showAllHref="/browse?sort=new"
          />
          <WorkRow
            dismissable
            title="Popular now"
            subtitle="The most shelved and reviewed works."
            works={feed.popular}
            showAllHref="/browse?sort=popular"
          />

          <section>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="font-heading text-lg">Your Library</h2>
              <Link
                href="/journal/new"
                className="btn-ghost text-xs hidden md:inline-flex"
              >
                + New Journal
              </Link>
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
