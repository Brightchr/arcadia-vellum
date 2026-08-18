import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { shellData } from "@/lib/nav";
import { listRecentActivity } from "@/lib/activity";
import {
  GENRES,
  listPublicWorks,
  popularTags,
  type SentimentTone,
  type WorkSort,
} from "@/lib/discovery";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { WorkCard, WorkCover } from "@/components/discover/WorkCard";
import { WorkRow } from "@/components/discover/WorkRow";
import { StoreFilters } from "@/components/discover/StoreFilters";
import { customThemeCssFor } from "@/lib/custom-themes";
import { ThemeStyle } from "@/components/book/ThemeStyle";
import { homeFeed, personalScore, tasteProfile } from "@/lib/recommendations";

export const metadata: Metadata = {
  title: "The Archives — Vellum",
};

const SENTIMENT_VALUES: SentimentTone[] = ["positive", "mixed", "negative"];
const SORT_VALUES: WorkSort[] = ["top", "new", "popular"];

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    tag?: string;
    sentiment?: string;
    sort?: string;
  }>;
}) {
  const { session, navUser, pins, unread } = await shellData();
  // The store is members-only — the archives don't face the open street.
  if (!session) redirect("/login");
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const type =
    params.type === "books" || params.type === "audiobooks"
      ? params.type
      : undefined;
  const tag = (params.tag ?? "").trim() || undefined;
  const sentiment = SENTIMENT_VALUES.includes(params.sentiment as SentimentTone)
    ? (params.sentiment as SentimentTone)
    : undefined;
  const sort = SORT_VALUES.includes(params.sort as WorkSort)
    ? (params.sort as WorkSort)
    : undefined;

  // Discovery rows only decorate the unfiltered front page of the Archives;
  // any search/filter/sort collapses to the classic grid.
  const filtered = Boolean(q || type || tag || sentiment || sort);
  const [pool, tags, recent, feed] = await Promise.all([
    listPublicWorks({ q: q || undefined, type, tag, sentiment, sort }),
    popularTags(),
    !filtered ? listRecentActivity(session.user.id) : Promise.resolve([]),
    !filtered ? homeFeed(session.user.id) : Promise.resolve(null),
  ]);

  // Signed-in default order is "For you": what they save, read, rate, and
  // dismiss steers the store. Explicit sorts and searches behave classically.
  let works = pool;
  let forYou = false;
  if (session) {
    const profile = await tasteProfile(session.user.id, pool);
    works = pool.filter((w) => !profile.disliked.has(`${w.kind}:${w.id}`));
    if (!sort && profile.hasSignals) {
      works = [...works].sort(
        (a, b) => personalScore(b, profile) - personalScore(a, profile)
      );
      forYou = true;
    }
  }

  const genreSet = new Set<string>(GENRES);
  const extraTags = tags.filter((t) => !genreSet.has(t)).slice(0, 12);

  const customCss = await customThemeCssFor([
    ...works.map((w) => w.theme),
    ...recent.map((a) => a.theme),
    ...(feed
      ? [
          feed.followedNew,
          feed.friendsRecommend,
          feed.bestReviewed,
          feed.newAndNoteworthy,
          feed.popular,
        ]
          .flat()
          .map((w) => w.theme)
      : []),
    ...(feed ? feed.tagRows.flatMap((r) => r.works.map((w) => w.theme)) : []),
  ]);
  const resultLabel = tag
    ? `${tag} — ${works.length} work${works.length === 1 ? "" : "s"}`
    : q
      ? `Results for "${q}" — ${works.length}`
      : `${works.length} work${works.length === 1 ? "" : "s"}${
          forYou ? " · ordered for you" : ""
        }`;

  return (
    <main
      className={`${appThemeClass(navUser?.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <ThemeStyle css={customCss} />
      <AppShell
        user={navUser}
        active="browse"
        pins={pins}
        unreadNotifications={unread}
      >
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
          <header className="mb-5">
            <h1 className="font-display text-2xl text-ink">The Archives</h1>
            <p className="text-sm text-ink-dim">
              Books and audiobooks bound by the community.
            </p>
          </header>

          {recent.length > 0 && (
            <section className="mb-8">
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

          {feed && (
            <div className="space-y-8 mb-10">
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
              <h2 className="font-heading text-lg !mb-[-0.5rem]">All Works</h2>
            </div>
          )}

          <StoreFilters
            q={q}
            type={type}
            tag={tag}
            sentiment={sentiment}
            sort={sort}
            signedIn={!!session}
            genres={GENRES}
            extraTags={extraTags}
          />

          <p className="mb-3 text-xs text-ink-dim">{resultLabel}</p>

          {works.length === 0 ? (
            <div className="panel-arcane p-12 text-center">
              <p className="font-heading text-xl mb-2">
                {q || tag || sentiment
                  ? "Nothing matched."
                  : "The archives are empty."}
              </p>
              <p className="text-ink-dim">
                {q || tag || sentiment
                  ? "Try a different search or clear the filters."
                  : "Public tomes will appear here as scribes share them."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {works.map((w) => (
                <WorkCard
                  key={`${w.kind}:${w.id}`}
                  work={w}
                  dismissable={!!session}
                />
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </main>
  );
}
