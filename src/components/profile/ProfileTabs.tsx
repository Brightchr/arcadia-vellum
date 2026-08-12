"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Work } from "@/lib/discovery";
import { WorkCard } from "@/components/discover/WorkCard";
import { HeadphonesIcon, PenIcon, SearchIcon, UsersIcon } from "@/components/icons";

export type ProfileTabKey = "works" | "playlists" | "saved" | "about";

export interface ProfilePlaylist {
  id: string;
  name: string;
  icon: string | null;
  count: number;
  visibility: "private" | "friends" | "public";
}

const TAB_LABELS: Record<ProfileTabKey, string> = {
  works: "Works",
  playlists: "Playlists",
  saved: "Shelf",
  about: "About",
};

type WorkFilter = "all" | "books" | "audiobooks" | "series";

const WORK_FILTERS: { key: WorkFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "books", label: "Books" },
  { key: "audiobooks", label: "Audiobooks" },
  { key: "series", label: "Series" },
];

function matchesFilter(w: Work, filter: WorkFilter, q: string): boolean {
  if (filter === "books" && !w.hasWritten) return false;
  if (filter === "audiobooks" && !w.hasAudio) return false;
  if (filter === "series" && w.kind !== "series") return false;
  if (q) {
    const needle = q.toLowerCase();
    const hit =
      w.title.toLowerCase().includes(needle) ||
      (w.author ?? "").toLowerCase().includes(needle) ||
      w.tags.some((t) => t.includes(needle));
    if (!hit) return false;
  }
  return true;
}

function WorkGrid({ works }: { works: Work[] }) {
  return (
    <div className="grid gap-4 sm:gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {works.map((w) => (
        <WorkCard key={`${w.kind}:${w.id}`} work={w} />
      ))}
    </div>
  );
}

/**
 * Channel-style profile body: tab bar with per-tab content, plus filter
 * chips and a title search inside the Works and Shelf tabs.
 */
export function ProfileTabs({
  tabs,
  works,
  featuredKeys,
  playlists,
  saved,
  bio,
  joined,
  isSelf,
}: {
  tabs: ProfileTabKey[];
  works: Work[];
  featuredKeys: string[];
  playlists: ProfilePlaylist[];
  saved: Work[];
  bio: string | null;
  joined: string;
  isSelf: boolean;
}) {
  const [active, setActive] = useState<ProfileTabKey>(tabs[0] ?? "works");
  const [filter, setFilter] = useState<WorkFilter>("all");
  const [q, setQ] = useState("");

  const featured = useMemo(() => {
    const keys = new Set(featuredKeys);
    return works.filter((w) => keys.has(`${w.kind}:${w.id}`));
  }, [works, featuredKeys]);

  const current = active === "saved" ? saved : works;
  const filtered = useMemo(
    () => current.filter((w) => matchesFilter(w, filter, q.trim())),
    [current, filter, q]
  );
  const unfiltered = filter === "all" && q.trim() === "";

  if (tabs.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Profile sections"
        className="flex items-center gap-1 border-b border-edge overflow-x-auto"
      >
        {tabs.map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={active === key}
            className={`px-4 py-2.5 text-sm font-heading whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active === key
                ? "border-arcane-bright text-arcane-bright"
                : "border-transparent text-ink-dim hover:text-ink"
            }`}
            onClick={() => {
              setActive(key);
              setFilter("all");
              setQ("");
            }}
          >
            {TAB_LABELS[key]}
            {key === "playlists" && playlists.length > 0 && (
              <span className="ml-1.5 text-xs text-ink-dim">
                {playlists.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Works / Shelf: filter chips + title search */}
      {(active === "works" || active === "saved") && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {WORK_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`px-3 py-1.5 rounded-full text-xs font-heading transition-colors ${
                  filter === f.key
                    ? "bg-arcane/20 text-arcane-bright border border-arcane/50"
                    : "bg-overlay text-ink-dim border border-transparent hover:text-ink"
                }`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
            <label className="relative ml-auto min-w-40 flex-1 sm:flex-none sm:w-56">
              <SearchIcon className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
              <input
                value={q}
                placeholder="Filter by title, author, tag..."
                aria-label="Filter works"
                className="input-arcane !py-1.5 !pl-9 text-sm"
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
          </div>

          {active === "works" && unfiltered && featured.length > 0 && (
            <section>
              <h2 className="font-heading text-lg mb-3">Featured</h2>
              <WorkGrid works={featured} />
            </section>
          )}

          <section>
            {active === "works" && unfiltered && featured.length > 0 && (
              <h2 className="font-heading text-lg mb-3">All Works</h2>
            )}
            {filtered.length === 0 ? (
              <p className="text-sm text-ink-dim italic py-6 text-center">
                {current.length === 0
                  ? active === "saved"
                    ? "Nothing on the shelf yet."
                    : isSelf
                      ? "No public works yet — publish a tome to fill this shelf."
                      : "No public works yet."
                  : "Nothing matches that filter."}
              </p>
            ) : (
              <WorkGrid
                works={
                  active === "works" && unfiltered && featured.length > 0
                    ? filtered.filter(
                        (w) =>
                          !featuredKeys.includes(`${w.kind}:${w.id}`)
                      )
                    : filtered
                }
              />
            )}
          </section>
        </>
      )}

      {/* Playlists */}
      {active === "playlists" &&
        (playlists.length === 0 ? (
          <p className="text-sm text-ink-dim italic py-6 text-center">
            {isSelf
              ? "No shared playlists yet — set a playlist to Friends or Everyone to show it here."
              : "No shared playlists yet."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((p) => (
              <Link
                key={p.id}
                href={`/playlists/${p.id}`}
                className="group panel-arcane p-4 flex items-center gap-3 hover:border-arcane/60 transition-colors"
              >
                <span className="h-12 w-12 rounded-lg bg-arcane/15 border border-arcane/30 inline-flex items-center justify-center text-xl shrink-0">
                  {p.icon ?? (
                    <HeadphonesIcon className="h-5 w-5 text-arcane-bright" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-sm truncate group-hover:text-arcane-bright transition-colors">
                    {p.name}
                  </span>
                  <span className="block text-xs text-ink-dim">
                    {p.count} audiobook{p.count === 1 ? "" : "s"}
                  </span>
                </span>
                {p.visibility === "friends" && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-heading uppercase tracking-wider text-ink-dim"
                    title="Visible to friends only"
                  >
                    <UsersIcon className="h-3 w-3" /> Friends
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}

      {/* About */}
      {active === "about" && (
        <div className="max-w-2xl space-y-4">
          {bio ? (
            <section className="panel-arcane p-5">
              <p className="text-sm whitespace-pre-wrap">{bio}</p>
            </section>
          ) : (
            <p className="text-sm text-ink-dim italic">
              {isSelf
                ? "No bio yet — add one in Settings."
                : "This scribe hasn't written a bio yet."}
            </p>
          )}
          <p className="text-xs text-ink-dim inline-flex items-center gap-1.5">
            <PenIcon className="h-3 w-3" /> Scribing since {joined}
          </p>
        </div>
      )}
    </div>
  );
}
