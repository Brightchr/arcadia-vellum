import Link from "next/link";
import type { Metadata } from "next";
import { sessionWithNav } from "@/lib/nav";
import { listPublicWorks, popularTags } from "@/lib/discovery";
import { appThemeClass } from "@/lib/themes";
import { AppNav } from "@/components/nav/AppNav";
import { WorkCard } from "@/components/discover/WorkCard";

export const metadata: Metadata = {
  title: "Browse — Arcadia Vellum",
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; tag?: string }>;
}) {
  const { navUser } = await sessionWithNav();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const type =
    params.type === "books" || params.type === "audiobooks"
      ? params.type
      : undefined;
  const tag = (params.tag ?? "").trim() || undefined;

  const [works, tags] = await Promise.all([
    listPublicWorks({ q: q || undefined, type, tag }),
    popularTags(),
  ]);

  const filterHref = (next: { type?: string; tag?: string }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const t = "type" in next ? next.type : type;
    const g = "tag" in next ? next.tag : tag;
    if (t) sp.set("type", t);
    if (g) sp.set("tag", g);
    const qs = sp.toString();
    return `/browse${qs ? `?${qs}` : ""}`;
  };

  const typeTab = (label: string, value?: string) => (
    <Link
      href={filterHref({ type: value })}
      className={`px-3 py-1.5 rounded-md text-sm font-heading transition-colors ${
        type === value
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
      <AppNav user={navUser} active="browse" />
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10">
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
          <button type="submit" className="btn-arcane">
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1 mb-4">
          {typeTab("All", undefined)}
          {typeTab("Books", "books")}
          {typeTab("Audiobooks", "audiobooks")}
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
              {q || tag ? "Nothing matched." : "The archives are empty."}
            </p>
            <p className="text-ink-dim">
              {q || tag
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
    </main>
  );
}
