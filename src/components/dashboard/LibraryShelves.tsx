"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Journal } from "@/lib/journals";
import type { Series } from "@/lib/series";
import { JournalCard } from "./JournalCard";

/**
 * The library as shelves: one container per series plus a loose-journals
 * section. Journals are draggable between shelves (HTML5 drag & drop);
 * dropping assigns/clears the series via PATCH.
 */
export function LibraryShelves({
  journals,
  seriesList,
}: {
  journals: Journal[];
  seriesList: Series[];
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

  const grouped = seriesList
    .map((s) => ({
      series: s,
      volumes: journals
        .filter((j) => j.seriesId === s.id)
        .sort(
          (a, b) =>
            (a.volumeNumber ?? Number.MAX_SAFE_INTEGER) -
              (b.volumeNumber ?? Number.MAX_SAFE_INTEGER) ||
            a.createdAt.getTime() - b.createdAt.getTime()
        ),
    }))
    .filter((g) => g.volumes.length > 0);
  const loose = journals.filter((j) => !j.seriesId);

  const shelfClass = (key: string) =>
    `rounded-xl border transition-colors p-5 ${
      overShelf === key
        ? "border-arcane bg-arcane/10"
        : "border-void-border bg-void-raised/40"
    }`;

  return (
    <div className={`space-y-8 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      {grouped.map(({ series: s, volumes }) => (
        <section
          key={s.id}
          className={shelfClass(s.id)}
          {...dropHandlers(s.id, s.name)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl text-arcane-bright">
                {s.name}
              </h2>
              <p className="text-sm text-ink-dim">
                {volumes.length} volume{volumes.length === 1 ? "" : "s"}
              </p>
            </div>
            <Link href={`/s/${s.slug}`} className="btn-arcane text-sm">
              Read the Series
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {volumes.map((j) => (
              <div key={j.id} {...draggable(j)} className="cursor-grab active:cursor-grabbing">
                <JournalCard journal={j} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className={shelfClass("loose")} {...dropHandlers("loose", "")}>
        <div className="mb-4">
          <h2 className="font-heading text-lg">Unbound Journals</h2>
          <p className="text-sm text-ink-dim">
            Drag a journal onto a collection to shelve it — or drop it here to
            unshelve.
          </p>
        </div>
        {loose.length === 0 ? (
          <p className="text-sm text-ink-dim italic">Every tome is shelved.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loose.map((j) => (
              <div key={j.id} {...draggable(j)} className="cursor-grab active:cursor-grabbing">
                <JournalCard journal={j} />
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
