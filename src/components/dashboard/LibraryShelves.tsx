"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Journal } from "@/lib/journals";
import type { Series } from "@/lib/series";
import { JournalCard } from "./JournalCard";
import { BookOpenIcon, HeadphonesIcon, PenIcon } from "@/components/icons";
import { compareVolumes } from "@/lib/volume";

/**
 * The library as shelves: one container per series plus a loose-journals
 * section. Journals are draggable between shelves (HTML5 drag & drop);
 * dropping assigns/clears the series via PATCH.
 */
export function LibraryShelves({
  journals,
  seriesList,
  trackCounts = {},
}: {
  journals: Journal[];
  seriesList: Series[];
  trackCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overShelf, setOverShelf] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function assign(journalId: string, seriesName: string) {
    setBusy(true);
    try {
      await fetch(`/api/journals/${journalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesName }),
      });
      router.refresh();
    } finally {
      setBusy(false);
      setDragId(null);
      setOverShelf(null);
    }
  }

  async function rename(s: Series) {
    const name = window.prompt("Rename this collection:", s.name)?.trim();
    if (!name || name === s.name) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/series/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        window.alert(body?.error ?? "Rename failed.");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function RenameButton({ series: s }: { series: Series }) {
    return (
      <button
        type="button"
        aria-label={`Rename ${s.name}`}
        title="Rename collection"
        disabled={busy}
        onClick={() => void rename(s)}
        className="rounded-md p-1.5 text-ink-dim hover:text-arcane-bright hover:bg-white/5 transition-colors shrink-0"
      >
        <PenIcon className="h-3.5 w-3.5" />
      </button>
    );
  }

  function dropHandlers(shelfKey: string, seriesName: string | null) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setOverShelf(shelfKey);
      },
      onDragLeave: () => setOverShelf(null),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/journal-id") || dragId;
        if (!id) return;
        if (seriesName === null) {
          const name = window.prompt(
            "Name the new collection (e.g. The Veyr Chronicles):"
          );
          if (name?.trim()) void assign(id, name.trim());
          else setOverShelf(null);
        } else {
          void assign(id, seriesName);
        }
      },
    };
  }

  function draggable(journal: Journal) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData("text/journal-id", journal.id);
        e.dataTransfer.effectAllowed = "move";
        setDragId(journal.id);
      },
      onDragEnd: () => {
        setDragId(null);
        setOverShelf(null);
      },
    };
  }

  /** Touch-friendly alternative to drag & drop: a shelf picker per card. */
  function ShelfPicker({ journal }: { journal: Journal }) {
    const currentName =
      seriesList.find((s) => s.id === journal.seriesId)?.name ?? "";
    return (
      <div className="mt-2 flex items-center gap-2 min-w-0">
        <span className="text-xs text-ink-dim shrink-0 font-heading">
          Shelf
        </span>
        <select
          className="input-arcane flex-1 min-w-0 !py-1 !px-2 text-xs"
          value={currentName}
          aria-label={`Collection for ${journal.title}`}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__new__") {
              const name = window.prompt(
                "Name the new collection (e.g. The Veyr Chronicles):"
              );
              if (name?.trim()) void assign(journal.id, name.trim());
              else e.target.value = currentName;
            } else {
              void assign(journal.id, v);
            }
          }}
        >
          <option value="">— no collection —</option>
          {seriesList.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
          <option value="__new__">➕ New collection…</option>
        </select>
      </div>
    );
  }

  // Audiobooks live on their own shelf; document journals fill the series
  // shelves and the unbound section.
  const audiobooks = journals
    .filter((j) => j.sourceType === "audio")
    .sort(compareVolumes);
  const docs = journals.filter((j) => j.sourceType !== "audio");

  const grouped = seriesList
    .map((s) => ({
      series: s,
      volumes: docs.filter((j) => j.seriesId === s.id).sort(compareVolumes),
      // The series listen page plays the audiobook volumes shelved here.
      hasAudio: journals.some(
        (j) =>
          j.seriesId === s.id &&
          j.sourceType === "audio" &&
          (trackCounts[j.id] ?? 0) > 0
      ),
    }))
    .filter((g) => g.volumes.length > 0);
  const loose = docs.filter((j) => !j.seriesId);

  // Audiobooks grouped by series — each group links to its series playlist.
  const audioBySeries = seriesList
    .map((s) => ({
      series: s,
      volumes: audiobooks.filter((j) => j.seriesId === s.id),
    }))
    .filter((g) => g.volumes.length > 0);
  const looseAudio = audiobooks.filter((j) => !j.seriesId);

  const shelfClass = (key: string) =>
    `rounded-xl border transition-colors p-3.5 sm:p-5 ${
      overShelf === key
        ? "border-arcane bg-arcane/10"
        : "border-void-border bg-void-raised/40"
    }`;

  return (
    <div className={`space-y-8 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      {grouped.map(({ series: s, volumes, hasAudio }) => (
        <section
          key={s.id}
          className={shelfClass(s.id)}
          {...dropHandlers(s.id, s.name)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl text-arcane-bright inline-flex items-center gap-1.5">
                {s.name}
                <RenameButton series={s} />
              </h2>
              <p className="text-sm text-ink-dim">
                {volumes.length} volume{volumes.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasAudio && (
                <Link href={`/s/${s.slug}/listen`} className="btn-ghost">
                  <HeadphonesIcon /> Listen
                </Link>
              )}
              <Link href={`/s/${s.slug}`} className="btn-arcane">
                <BookOpenIcon /> Read the Series
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {volumes.map((j) => (
              <div key={j.id} {...draggable(j)} className="cursor-grab active:cursor-grabbing">
                <JournalCard journal={j} trackCount={trackCounts[j.id] ?? 0} />
                <ShelfPicker journal={j} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {audiobooks.length > 0 && (
        <section className="rounded-xl border border-void-border bg-void-raised/40 p-3.5 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl text-arcane-bright inline-flex items-center gap-2">
                <HeadphonesIcon className="h-5 w-5" /> Audiobooks
              </h2>
              <p className="text-sm text-ink-dim">
                Audio-only tomes — pure listening, no pages.
              </p>
            </div>
            {audiobooks.some((j) => (trackCounts[j.id] ?? 0) > 0) && (
              <Link href="/dashboard/listen" className="btn-arcane">
                <HeadphonesIcon /> Listen to All
              </Link>
            )}
          </div>
          <div className="space-y-6">
            {audioBySeries.map(({ series: s, volumes }) => (
              <div
                key={s.id}
                className={shelfClass(`audio-${s.id}`)}
                {...dropHandlers(`audio-${s.id}`, s.name)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h3 className="font-heading text-base text-arcane-bright inline-flex items-center gap-1.5">
                    {s.name}{" "}
                    <span className="text-ink-dim text-sm font-normal">
                      · {volumes.length} volume{volumes.length === 1 ? "" : "s"}
                    </span>
                    <RenameButton series={s} />
                  </h3>
                  {volumes.some((v) => (trackCounts[v.id] ?? 0) > 0) && (
                    <Link
                      href={`/s/${s.slug}/listen`}
                      className="btn-ghost text-xs px-3 py-1.5"
                    >
                      <HeadphonesIcon className="h-3.5 w-3.5" /> Listen to the
                      Series
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {volumes.map((j) => (
                    <div
                      key={j.id}
                      {...draggable(j)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <JournalCard
                        journal={j}
                        trackCount={trackCounts[j.id] ?? 0}
                      />
                      <ShelfPicker journal={j} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div
              className={shelfClass("audio-loose")}
              {...dropHandlers("audio-loose", "")}
            >
              <h3 className="font-heading text-base text-ink-dim mb-3">
                Unshelved
              </h3>
              {looseAudio.length === 0 ? (
                <p className="text-sm text-ink-dim italic">
                  Drop an audiobook here to unshelve it.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {looseAudio.map((j) => (
                    <div
                      key={j.id}
                      {...draggable(j)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <JournalCard
                        journal={j}
                        trackCount={trackCounts[j.id] ?? 0}
                      />
                      <ShelfPicker journal={j} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className={shelfClass("loose")} {...dropHandlers("loose", "")}>
        <div className="mb-4">
          <h2 className="font-heading text-lg">Unbound Journals</h2>
          <p className="text-sm text-ink-dim">
            Drag a journal onto a collection to shelve it, or use each card&apos;s
            Shelf picker. Drop here to unshelve.
          </p>
        </div>
        {loose.length === 0 ? (
          <p className="text-sm text-ink-dim italic">Every tome is shelved.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loose.map((j) => (
              <div key={j.id} {...draggable(j)} className="cursor-grab active:cursor-grabbing">
                <JournalCard journal={j} trackCount={trackCounts[j.id] ?? 0} />
                <ShelfPicker journal={j} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
          overShelf === "new"
            ? "border-arcane bg-arcane/10 text-arcane-bright"
            : "border-void-border text-ink-dim"
        }`}
        {...dropHandlers("new", null)}
      >
        <p className="font-heading text-sm">
          ✦ Drop a journal here to start a new collection ✦
        </p>
      </section>
    </div>
  );
}
