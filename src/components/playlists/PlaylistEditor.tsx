"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlaylistItemView } from "@/lib/playlists";
import { WorkCover } from "@/components/discover/WorkCard";
import { HeadphonesIcon } from "@/components/icons";

interface Addable {
  id: string;
  title: string;
}

/** Spotify-style playlist manager: drag rows to set the play order. */
export function PlaylistEditor({
  playlistId,
  items: initialItems,
  addable,
}: {
  playlistId: string;
  items: PlaylistItemView[];
  addable: Addable[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const inList = new Set(items.map((i) => i.journalId));
  const candidates = addable.filter((a) => !inList.has(a.id));

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/playlists/${playlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function drop(target: number) {
    if (dragIndex === null || dragIndex === target) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(target, 0, moved);
    setItems(next);
    setDragIndex(null);
    setOverIndex(null);
    void patch({ order: next.map((i) => i.journalId) });
  }

  return (
    <div className="space-y-5">
      {items.length === 0 ? (
        <p className="text-sm text-ink-dim italic">
          No audiobooks yet — add some below and drag them into your listening
          order.
        </p>
      ) : (
        <ol className="space-y-1">
          {items.map((item, i) => (
            <li
              key={item.journalId}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(i);
              }}
              onDragLeave={() => setOverIndex(null)}
              onDrop={(e) => {
                e.preventDefault();
                drop(i);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${
                overIndex === i && dragIndex !== null && dragIndex !== i
                  ? "border-arcane bg-arcane/10"
                  : "border-void-border bg-overlay"
              } ${dragIndex === i ? "opacity-50" : ""}`}
            >
              <span className="font-heading text-xs text-ink-dim w-5 shrink-0">
                {i + 1}.
              </span>
              <span className="w-9 shrink-0">
                <WorkCover
                  work={{
                    title: item.title,
                    author: null,
                    theme: item.theme,
                    coverImageId: item.coverImageId,
                  }}
                  className="!rounded-md"
                />
              </span>
              <span className="text-sm truncate flex-1">
                {item.title}
                {!item.playable && (
                  <span className="text-xs text-ink-dim ml-2">
                    (no longer available)
                  </span>
                )}
              </span>
              <span className="text-ink-dim text-xs shrink-0" aria-hidden>
                ⠿
              </span>
              <button
                type="button"
                className="btn-ghost text-xs px-2 py-1 !text-red-400 hover:!border-red-400 shrink-0"
                disabled={busy}
                aria-label={`Remove ${item.title}`}
                onClick={() => void patch({ remove: item.journalId })}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      {candidates.length > 0 && (
        <div className="border-t border-void-border pt-4">
          <p className="font-heading text-sm mb-2 inline-flex items-center gap-1.5">
            <HeadphonesIcon className="h-4 w-4" /> Add an audiobook
          </p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                className="btn-ghost text-xs px-3 py-1.5"
                disabled={busy}
                onClick={() => void patch({ add: c.id })}
              >
                + {c.title}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-dim mt-2">
            Your audiobooks and saved public audiobooks can be added.
          </p>
        </div>
      )}
    </div>
  );
}
