"use client";

import { useEffect, useRef, useState } from "react";
import type { NarrationTrack } from "./NarrationPlayer";

const SPEEDS = [0.75, 1, 1.25, 1.5];

function fmt(t: number): string {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Full audiobook experience: chapter list, transport controls, speed,
 * position memory (localStorage), and lock-screen media controls.
 */
export function AudiobookPlayer({
  tracks,
  title,
  author,
  storageKey,
}: {
  tracks: NarrationTrack[];
  title: string;
  author?: string | null;
  storageKey: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const restored = useRef(false);
  const pendingSeek = useRef(0);

  const track = tracks[Math.min(index, tracks.length - 1)];

  // Restore last listening position.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved && typeof saved.i === "number" && saved.i < tracks.length) {
        setIndex(saved.i);
        pendingSeek.current = typeof saved.t === "number" ? saved.t : 0;
      }
      if (saved && SPEEDS.includes(saved.s)) setSpeed(saved.s);
    } catch {
      // First listen.
    }
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(i: number, t: number, s: number) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ i, t, s }));
    } catch {
      // Storage full/blocked — position memory is best-effort.
    }
  }

  // Lock-screen / media-key metadata.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: author ?? title,
      album: title,
      artwork: [{ src: "/mark.png", sizes: "192x192", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("play", () => {
      void audioRef.current?.play();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
    });
    navigator.mediaSession.setActionHandler("previoustrack", () =>
      go(index - 1)
    );
    navigator.mediaSession.setActionHandler("nexttrack", () => go(index + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, track?.id]);

  function go(next: number, autoplay = true) {
    const clamped = Math.max(0, Math.min(tracks.length - 1, next));
    if (clamped === index) return;
    pendingSeek.current = 0;
    setIndex(clamped);
    setTime(0);
    persist(clamped, 0, speed);
    if (autoplay) {
      requestAnimationFrame(() =>
        void audioRef.current?.play().catch(() => {})
      );
    }
  }

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }

  function skip(delta: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
    persist(index, audioRef.current?.currentTime ?? 0, next);
  }

  if (!track) return null;

  return (
    <div className="panel-arcane p-5 sm:p-6 w-full">
      <audio
        ref={audioRef}
        key={track.id}
        src={`/api/audio/${track.id}`}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setDuration(el.duration || 0);
          el.playbackRate = speed;
          if (pendingSeek.current > 0) {
            el.currentTime = Math.min(pendingSeek.current, el.duration || 0);
            pendingSeek.current = 0;
          }
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          if (Math.floor(t) % 5 === 0) persist(index, t, speed);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (index < tracks.length - 1) go(index + 1);
          else {
            setPlaying(false);
            persist(0, 0, speed);
          }
        }}
      />

      {/* Seek */}
      <div className="flex items-center gap-3 text-xs text-ink-dim font-heading">
        <span className="w-10 text-right">{fmt(time)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={1}
          value={Math.min(time, duration || 1)}
          aria-label="Seek"
          className="flex-1 accent-[var(--arcane)]"
          onChange={(e) => {
            const t = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = t;
            setTime(t);
          }}
        />
        <span className="w-10">{fmt(duration)}</span>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-3 sm:gap-5 mt-4">
        <button
          type="button"
          className="btn-ghost !px-3 !py-2 text-xs"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          aria-label="Previous chapter"
        >
          ⏮
        </button>
        <button
          type="button"
          className="btn-ghost !px-3 !py-2 text-xs"
          onClick={() => skip(-15)}
          aria-label="Back 15 seconds"
        >
          −15s
        </button>
        <button
          type="button"
          className="btn-arcane !rounded-full h-14 w-14 !p-0 text-xl"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          className="btn-ghost !px-3 !py-2 text-xs"
          onClick={() => skip(15)}
          aria-label="Forward 15 seconds"
        >
          +15s
        </button>
        <button
          type="button"
          className="btn-ghost !px-3 !py-2 text-xs"
          disabled={index === tracks.length - 1}
          onClick={() => go(index + 1)}
          aria-label="Next chapter"
        >
          ⏭
        </button>
      </div>

      <div className="flex items-center justify-center mt-3">
        <button
          type="button"
          className="btn-ghost !px-3 !py-1 text-xs"
          onClick={cycleSpeed}
        >
          {speed}× speed
        </button>
      </div>

      {/* Chapters */}
      <ol className="mt-5 max-h-48 overflow-y-auto space-y-1 pr-1">
        {tracks.map((t, i) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => go(i)}
              className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition ${
                i === index
                  ? "bg-arcane/15 text-arcane-bright"
                  : "text-ink-dim hover:text-ink hover:bg-void-raised"
              }`}
            >
              <span className="font-heading text-xs mr-2">
                {i === index && playing ? "♪" : i + 1 + "."}
              </span>
              {t.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
