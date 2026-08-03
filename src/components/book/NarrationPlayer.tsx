"use client";

import { useRef, useState } from "react";

export interface NarrationTrack {
  id: string;
  title: string;
}

/**
 * Floating narration player for the reader: collapsed to a small rune button,
 * expands to a themed panel with track controls and a native audio element.
 */
export function NarrationPlayer({ tracks }: { tracks: NarrationTrack[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  if (tracks.length === 0) return null;
  const track = tracks[Math.min(index, tracks.length - 1)];

  function go(next: number) {
    const clamped = Math.max(0, Math.min(tracks.length - 1, next));
    setIndex(clamped);
    // Let React swap the src, then play.
    requestAnimationFrame(() => void audioRef.current?.play().catch(() => {}));
  }

  return (
    <div className="absolute bottom-3 left-3 z-40">
      {!open ? (
        <button
          type="button"
          aria-label="Open narration player"
          className="h-11 w-11 rounded-full border border-void-border bg-void-raised/80 backdrop-blur text-xl shadow-lg shadow-black/40 hover:border-arcane transition"
          onClick={() => setOpen(true)}
        >
          🎧
        </button>
      ) : (
        <div className="panel-arcane p-3 w-72 max-w-[calc(100vw-1.5rem)]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="font-heading text-xs text-arcane-bright truncate">
              🎧 {track.title}
            </p>
            <button
              type="button"
              aria-label="Close narration player"
              className="text-ink-dim hover:text-ink text-sm shrink-0"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          <audio
            ref={audioRef}
            key={track.id}
            src={`/api/audio/${track.id}`}
            controls
            preload="metadata"
            className="w-full h-9"
            onEnded={() => {
              if (index < tracks.length - 1) go(index + 1);
            }}
          />

          {tracks.length > 1 && (
            <div className="flex items-center justify-between mt-2 text-xs">
              <button
                type="button"
                className="btn-ghost !px-2 !py-1 text-xs"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                ‹ Prev
              </button>
              <span className="text-ink-dim font-heading">
                {index + 1} / {tracks.length}
              </span>
              <button
                type="button"
                className="btn-ghost !px-2 !py-1 text-xs"
                disabled={index === tracks.length - 1}
                onClick={() => go(index + 1)}
              >
                Next ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
