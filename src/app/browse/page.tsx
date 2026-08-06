import Link from "next/link";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import {
  listPublicWorks,
  popularTags,
  type SentimentTone,
  type WorkSort,
} from "@/lib/discovery";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { WorkCard } from "@/components/discover/WorkCard";

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
  const { navUser, pins, unread } = await shellData();
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

  const [works, tags] = await Promise.all([
    listPublicWorks({ q: q || undefined, type, tag, sentiment, sort }),
    popularTags(),
  ]);

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
      className={`px-3 py-1.5 rounded-md text-sm font-heading transition-colors ${
        activeChip
          ? "bg-arcane/15 text-arcane-bright"
          : "text-ink-dim hover:text-ink hover:bg-white/5"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <main
      className={`${appThemeClass(navUser?.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell
        user={navUser}
        active="browse"
        pins={pins}
        unreadNotifications={unread}
      >
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-6">
          <h1 className="font-display text-2xl text-arcane-bright">
            Browse the Archives
          </h1>
          <p className="text-sm text-ink-dim">
            Public books and audiobooks bound by the community.
          </p>
        </header>

        <form action="/browse" method="get" className="mb-4 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search titles, authors, tags..."
            className="input-arcane max-w-md"
            aria-label="Search"
          />
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <div className="flex flex-wrap items-center gap-1">
            {chip("All", filterHref({ type: undefined }), type === undefined)}
            {chip("Books", filterHref({ type: "books" }), type === "books")}
            {chip(
              "Audiobooks",
              filterHref({ type: "audiobooks" }),
              type === "audiobooks"
            )}
          </div>

          <span className="hidden sm:block h-5 w-px bg-white/10" aria-hidden />

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

          <span className="hidden sm:block h-5 w-px bg-white/10" aria-hidden />

          <div className="flex flex-wrap items-center gap-1">
            {SORTS.map((s) =>
              chip(
                s.label,
                filterHref({ sort: s.value === "top" ? undefined : s.value }),
                (sort ?? "top") === s.value
              )
            )}
          </div>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-8">
            {tags.map((t) => (
              <Link
                key={t}
                href={filterHref({ tag: tag === t ? undefined : t })}
                className={`rounded-full px-2.5 py-1 text-xs font-heading uppercase tracking-wider transition-colors ${
                  tag === t
                    ? "bg-arcane/20 text-arcane-bright"
                    : "bg-white/5 text-ink-dim hover:text-ink"
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        )}

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
              <WorkCard key={`${w.kind}:${w.id}`} work={w} />
            ))}
          </div>
        )}
      </div>
      </AppShell>
    </main>
  );
}
