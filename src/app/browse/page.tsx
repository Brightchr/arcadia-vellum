import Link from "next/link";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import {
  GENRES,
  listPublicWorks,
  popularTags,
  type SentimentTone,
  type WorkSort,
} from "@/lib/discovery";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { WorkCard } from "@/components/discover/WorkCard";
import { customThemeCssFor } from "@/lib/custom-themes";
import { ThemeStyle } from "@/components/book/ThemeStyle";
import { SearchIcon } from "@/components/icons";
import { personalScore, tasteProfile } from "@/lib/recommendations";

export const metadata: Metadata = {
  title: "Browse — Vellum",
};

const SENTIMENTS: { value: SentimentTone; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "mixed", label: "Mixed" },
  { value: "negative", label: "Negative" },
];

const SORTS: { value: WorkSort; label: string }[] = [
  { value: "top", label: "Top rated" },
  { value: "new", label: "Newest" },
  { value: "popular", label: "Popular" },
];

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
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const type =
    params.type === "books" || params.type === "audiobooks"
      ? params.type
      : undefined;
  const tag = (params.tag ?? "").trim() || undefined;
  const sentiment = SENTIMENTS.some((s) => s.value === params.sentiment)
    ? (params.sentiment as SentimentTone)
    : undefined;
  const sort = SORTS.some((s) => s.value === params.sort)
    ? (params.sort as WorkSort)
    : undefined;

  const [pool, tags] = await Promise.all([
    listPublicWorks({ q: q || undefined, type, tag, sentiment, sort }),
    popularTags(),
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

  const filterHref = (next: {
    type?: string;
    tag?: string;
    sentiment?: string;
    sort?: string;
  }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const t = "type" in next ? next.type : type;
    const g = "tag" in next ? next.tag : tag;
    const s = "sentiment" in next ? next.sentiment : sentiment;
    const o = "sort" in next ? next.sort : sort;
    if (t) sp.set("type", t);
    if (g) sp.set("tag", g);
    if (s) sp.set("sentiment", s);
    if (o) sp.set("sort", o);
    const qs = sp.toString();
    return `/browse${qs ? `?${qs}` : ""}`;
  };

  const chip = (
    label: string,
    href: string,
    activeChip: boolean,
    title?: string
  ) => (
    <Link
      key={label}
      href={href}
      title={title}
      className={`px-3 py-1.5 rounded-full text-sm font-heading transition-colors ${
        activeChip
          ? "bg-arcane/15 text-arcane-bright ring-1 ring-arcane/50"
          : "bg-overlay text-ink-dim hover:text-ink hover:bg-overlay-strong"
      }`}
    >
      {label}
    </Link>
  );

  // Genre shelf first, then whatever else the community is tagging with.
  const genreSet = new Set<string>(GENRES);
  const extraTags = tags.filter((t) => !genreSet.has(t)).slice(0, 12);
  const genreChip = (t: string) => (
    <Link
      key={t}
      href={filterHref({ tag: tag === t ? undefined : t })}
      className={`rounded-full px-3 py-1.5 text-xs font-heading uppercase tracking-wider transition-colors ${
        tag === t
          ? "bg-arcane/20 text-arcane-bright ring-1 ring-arcane/50"
          : "bg-overlay text-ink-dim hover:text-ink hover:bg-overlay-strong"
      }`}
    >
      {t}
    </Link>
  );

  const customCss = await customThemeCssFor(works.map((w) => w.theme));
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
          <header className="mb-6">
            <h1 className="font-display text-2xl text-ink">The Store</h1>
            <p className="text-sm text-ink-dim">
              Books and audiobooks bound by the community — browse by genre,
              search, or dig through the tags.
            </p>
          </header>

          {/* Search */}
          <form action="/browse" method="get" className="mb-5 flex gap-2">
            <div className="relative flex-1 max-w-xl">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search titles, authors, tags..."
                className="input-arcane !pl-10"
                aria-label="Search"
              />
            </div>
            {type && <input type="hidden" name="type" value={type} />}
            {tag && <input type="hidden" name="tag" value={tag} />}
            {sentiment && (
              <input type="hidden" name="sentiment" value={sentiment} />
            )}
            {sort && <input type="hidden" name="sort" value={sort} />}
            <button type="submit" className="btn-arcane">
              Search
            </button>
          </form>

          {/* Genres */}
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-heading uppercase tracking-[0.2em] text-ink-dim">
              Genres
            </p>
            <div className="flex flex-wrap gap-1.5">
              {GENRES.map((g) => genreChip(g))}
              {extraTags.map((t) => genreChip(t))}
            </div>
          </div>

          {/* Format / reviews / sort */}
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-edge bg-overlay p-2.5">
            <div className="flex flex-wrap items-center gap-1">
              {chip("All", filterHref({ type: undefined }), type === undefined)}
              {chip("Books", filterHref({ type: "books" }), type === "books")}
              {chip(
                "Audiobooks",
                filterHref({ type: "audiobooks" }),
                type === "audiobooks"
              )}
            </div>

            <span className="hidden sm:block h-5 w-px bg-edge" aria-hidden />

            {/* Steam-style review verdict filter */}
            <div className="flex flex-wrap items-center gap-1">
              {chip(
                "All reviews",
                filterHref({ sentiment: undefined }),
                sentiment === undefined
              )}
              {SENTIMENTS.map((s) =>
                chip(
                  s.label,
                  filterHref({
                    sentiment: sentiment === s.value ? undefined : s.value,
                  }),
                  sentiment === s.value,
                  `Only works with ${s.label.toLowerCase()} reviews`
                )
              )}
            </div>

            <span className="hidden sm:block h-5 w-px bg-edge" aria-hidden />

            <div className="flex flex-wrap items-center gap-1">
              {session &&
                chip(
                  "For you",
                  filterHref({ sort: undefined }),
                  sort === undefined,
                  "Ordered by your saves, reads, and ratings"
                )}
              {SORTS.map((s) =>
                chip(
                  s.label,
                  filterHref({
                    sort: !session && s.value === "top" ? undefined : s.value,
                  }),
                  session
                    ? sort === s.value
                    : (sort ?? "top") === s.value
                )
              )}
            </div>
          </div>

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
