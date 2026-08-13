"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "@/components/icons";

/**
 * The store's control bar: search, one Filters button (badged with the
 * active count), and a sort dropdown. Genre/format/review pickers live in a
 * modal so the page isn't buried under chip rows — same UX on phone and PC.
 * Filters apply instantly; active ones show as removable chips.
 */
export function StoreFilters({
  q,
  type,
  tag,
  sentiment,
  sort,
  signedIn,
  genres,
  extraTags,
}: {
  q: string;
  type?: "books" | "audiobooks";
  tag?: string;
  sentiment?: "positive" | "mixed" | "negative";
  sort?: "top" | "new" | "popular";
  signedIn: boolean;
  genres: readonly string[];
  extraTags: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(q);

  function push(next: {
    q?: string;
    type?: string | undefined;
    tag?: string | undefined;
    sentiment?: string | undefined;
    sort?: string | undefined;
  }) {
    const sp = new URLSearchParams();
    const val = (key: "q" | "type" | "tag" | "sentiment" | "sort", cur?: string) =>
      key in next ? next[key] : cur;
    const qq = val("q", q);
    const t = val("type", type);
    const g = val("tag", tag);
    const s = val("sentiment", sentiment);
    const o = val("sort", sort);
    if (qq) sp.set("q", qq);
    if (t) sp.set("type", t);
    if (g) sp.set("tag", g);
    if (s) sp.set("sentiment", s);
    if (o) sp.set("sort", o);
    const qs = sp.toString();
    router.push(`/browse${qs ? `?${qs}` : ""}`);
  }

  const activeCount = (type ? 1 : 0) + (tag ? 1 : 0) + (sentiment ? 1 : 0);

  const sortOptions = [
    ...(signedIn ? [{ value: "", label: "For you" }] : []),
    { value: "top", label: "Top rated" },
    { value: "new", label: "Newest" },
    { value: "popular", label: "Popular" },
  ];
  // Signed-out default (no sort param) is Top rated.
  const sortValue = sort ?? (signedIn ? "" : "top");

  const chip = (
    label: string,
    active: boolean,
    onClick: () => void,
    activeClass = "bg-arcane/20 text-arcane-bright ring-1 ring-arcane/50"
  ) => (
    <button
      key={label}
      type="button"
      className={`rounded-full px-3 py-1.5 text-xs font-heading uppercase tracking-wider transition-colors ${
        active
          ? activeClass
          : "bg-overlay text-ink-dim hover:text-ink hover:bg-overlay-strong"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const SENTIMENTS = [
    { value: "positive", label: "Positive" },
    { value: "mixed", label: "Mixed" },
    { value: "negative", label: "Negative" },
  ] as const;

  return (
    <div className="mb-6 space-y-3">
      {/* Toolbar: search / filters / sort */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-0 flex-1 basis-56"
          onSubmit={(e) => {
            e.preventDefault();
            push({ q: search.trim() });
          }}
          role="search"
        >
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
          <input
            type="search"
            value={search}
            placeholder="Search titles, authors, tags..."
            className="input-arcane !pl-10"
            aria-label="Search"
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <button
          type="button"
          className="btn-ghost relative shrink-0"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          Filters
          {activeCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-arcane px-1 text-[10px] font-bold leading-5 text-(--btn-ink)">
              {activeCount}
            </span>
          )}
        </button>
        <select
          aria-label="Sort by"
          className="input-arcane !w-auto shrink-0 !py-2"
          value={sortValue}
          onChange={(e) => push({ sort: e.target.value || undefined })}
        >
          {sortOptions.map((o) => (
            <option key={o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Active filters as removable chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tag && (
            <RemovableChip
              label={tag}
              onRemove={() => push({ tag: undefined })}
            />
          )}
          {type && (
            <RemovableChip
              label={type === "books" ? "Books" : "Audiobooks"}
              onRemove={() => push({ type: undefined })}
            />
          )}
          {sentiment && (
            <RemovableChip
              label={`${sentiment[0].toUpperCase()}${sentiment.slice(1)} reviews`}
              onRemove={() => push({ sentiment: undefined })}
            />
          )}
          <button
            type="button"
            className="px-2 text-xs text-ink-dim hover:text-ink"
            onClick={() =>
              push({ tag: undefined, type: undefined, sentiment: undefined })
            }
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter panel */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Store filters"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="panel-arcane flex max-h-[85dvh] w-full max-w-lg flex-col !rounded-b-none sm:!rounded-b-xl">
            <div className="flex items-center justify-between border-b border-void-border px-5 py-3">
              <p className="font-heading text-base">Filters</p>
              <button
                type="button"
                aria-label="Close filters"
                className="rounded p-1.5 text-ink-dim hover:bg-overlay hover:text-ink"
                onClick={() => setOpen(false)}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <section>
                <p className="mb-2 text-[10px] font-heading uppercase tracking-[0.2em] text-ink-dim">
                  Genre
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {genres.map((g) =>
                    chip(g, tag === g, () =>
                      push({ tag: tag === g ? undefined : g })
                    )
                  )}
                </div>
                {extraTags.length > 0 && (
                  <>
                    <p className="mb-2 mt-3 text-[10px] font-heading uppercase tracking-[0.2em] text-ink-dim/70">
                      Community tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {extraTags.map((g) =>
                        chip(g, tag === g, () =>
                          push({ tag: tag === g ? undefined : g })
                        )
                      )}
                    </div>
                  </>
                )}
              </section>

              <section>
                <p className="mb-2 text-[10px] font-heading uppercase tracking-[0.2em] text-ink-dim">
                  Format
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {chip("All", !type, () => push({ type: undefined }))}
                  {chip("Books", type === "books", () =>
                    push({ type: type === "books" ? undefined : "books" })
                  )}
                  {chip("Audiobooks", type === "audiobooks", () =>
                    push({
                      type: type === "audiobooks" ? undefined : "audiobooks",
                    })
                  )}
                </div>
              </section>

              <section>
                <p className="mb-2 text-[10px] font-heading uppercase tracking-[0.2em] text-ink-dim">
                  Review verdict
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {chip("All", !sentiment, () => push({ sentiment: undefined }))}
                  {SENTIMENTS.map((s) =>
                    chip(s.label, sentiment === s.value, () =>
                      push({
                        sentiment:
                          sentiment === s.value ? undefined : s.value,
                      })
                    )
                  )}
                </div>
              </section>
            </div>
            <div className="flex justify-between gap-2 border-t border-void-border px-5 py-3">
              <button
                type="button"
                className="btn-ghost text-xs px-3 py-1.5"
                disabled={activeCount === 0}
                onClick={() =>
                  push({ tag: undefined, type: undefined, sentiment: undefined })
                }
              >
                Clear all
              </button>
              <button
                type="button"
                className="btn-arcane text-xs px-4 py-1.5"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RemovableChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-arcane/15 py-1 pl-3 pr-1.5 text-xs font-heading text-arcane-bright">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        className="rounded-full px-1 hover:bg-arcane/20"
        onClick={onRemove}
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}
