"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  RepeatOneIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from "@/components/icons";

type RepeatMode = "off" | "all" | "one";

const VOLUME_KEY = "av-volume";

const SPEEDS = [0.75, 1, 1.25, 1.5];

export interface NarrationTrack {
  id: string;
  title: string;
  /** Backdrop for while this track plays (the volume's cover image). */
  coverUrl?: string | null;
  /** Audio ids played back-to-back as this one entry (defaults to [id]). */
  segmentIds?: string[];
}

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
  fallbackArt,
}: {
  tracks: NarrationTrack[];
  title: string;
  author?: string | null;
  storageKey: string;
  /** Shown as album art when the playing track has no cover image. */
  fallbackArt?: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const restored = useRef(false);
  const pendingSeek = useRef(0);
  // onEnded closures need the current mode without re-mounting the audio tag.
  const repeatRef = useRef<RepeatMode>("off");
  repeatRef.current = repeat;
  // Which file of a multi-file entry is playing.
  const [segIndex, setSegIndex] = useState(0);
  const segRef = useRef(0);
  segRef.current = segIndex;

  const track = tracks[Math.min(index, tracks.length - 1)];
  const segments = track?.segmentIds?.length ? track.segmentIds : track ? [track.id] : [];
  const audioId = segments[Math.min(segIndex, segments.length - 1)];

  // Size the album art to the largest 3:4 box that fits the free space —
  // as wide as the player when the screen is tall enough.
  const artZoneRef = useRef<HTMLDivElement>(null);
  const [artWidth, setArtWidth] = useState<number | null>(null);
  useEffect(() => {
    const el = artZoneRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setArtWidth(Math.max(0, Math.floor(Math.min(r.width, r.height * 0.75))));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Restore last listening position.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved && typeof saved.i === "number" && saved.i < tracks.length) {
        setIndex(saved.i);
        const segs = tracks[saved.i]?.segmentIds?.length ?? 1;
        if (typeof saved.g === "number" && saved.g < segs) setSegIndex(saved.g);
        pendingSeek.current = typeof saved.t === "number" ? saved.t : 0;
      }
      if (saved && SPEEDS.includes(saved.s)) setSpeed(saved.s);
      if (saved && ["off", "all", "one"].includes(saved.r)) setRepeat(saved.r);
      const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? "");
      if (Number.isFinite(v) && v >= 0 && v <= 1) setVolume(v);
    } catch {
      // First listen.
    }
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(i: number, t: number, s: number) {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ i, t, s, r: repeatRef.current, g: segRef.current })
      );
    } catch {
      // Storage full/blocked — position memory is best-effort.
    }
  }

  function cycleRepeat() {
    const next: RepeatMode =
      repeat === "off" ? "all" : repeat === "all" ? "one" : "off";
    setRepeat(next);
    repeatRef.current = next;
    persist(index, audioRef.current?.currentTime ?? 0, speed);
  }

  // Lock-screen / media-key metadata.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !track) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: author ?? title,
      album: title,
      artwork: track.coverUrl
        ? [{ src: track.coverUrl }]
        : [{ src: "/mark.png", sizes: "192x192", type: "image/png" }],
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
    if (clamped === index && segRef.current === 0) return;
    pendingSeek.current = 0;
    setIndex(clamped);
    setSegIndex(0);
    segRef.current = 0;
    setTime(0);
    persist(clamped, 0, speed);
    if (autoplay) {
      requestAnimationFrame(() =>
        void audioRef.current?.play().catch(() => {})
      );
    }
  }

  /** Advance to the next file of the same entry, keeping playback rolling. */
  function nextSegment() {
    setSegIndex((s) => {
      segRef.current = s + 1;
      return s + 1;
    });
    setTime(0);
    requestAnimationFrame(() => void audioRef.current?.play().catch(() => {}));
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

  function changeVolume(v: number) {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      // Best-effort.
    }
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
    persist(index, audioRef.current?.currentTime ?? 0, next);
  }

  if (!track) return null;

  return (
    <div className="flex-1 flex flex-col w-full min-h-0">
      {/* Album art floats over the theme's ambience; swaps per volume. */}
      <div
        ref={artZoneRef}
        className="flex-1 min-h-0 grid place-items-center py-4"
      >
        <div
          className="aspect-[3/4]"
          style={
            artWidth !== null
              ? ({ width: artWidth, "--art": `${artWidth}px` } as React.CSSProperties)
              : { width: 208, visibility: "hidden" }
          }
        >
          {track.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.coverUrl}
              alt=""
              className="w-full h-full object-cover rounded-xl border border-white/15 shadow-2xl shadow-black/60"
            />
          ) : (
            fallbackArt
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.07] backdrop-blur-xl shadow-2xl shadow-black/40 p-4 sm:p-5 w-full space-y-3">
      <audio
        ref={audioRef}
        key={audioId}
        src={`/api/audio/${audioId}`}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          setDuration(el.duration || 0);
          el.playbackRate = speed;
          el.volume = volume;
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
        onEnded={(e) => {
          const el = e.currentTarget;
          const mode = repeatRef.current;
          // A multi-file entry keeps rolling through its segments first.
          if (segRef.current < segments.length - 1) {
            nextSegment();
            return;
          }
          if (mode === "one") {
            if (segments.length > 1) {
              setSegIndex(0);
              segRef.current = 0;
              setTime(0);
              requestAnimationFrame(() =>
                void audioRef.current?.play().catch(() => {})
              );
            } else {
              el.currentTime = 0;
              void el.play().catch(() => {});
            }
          } else if (index < tracks.length - 1) {
            go(index + 1);
          } else if (mode === "all") {
            if (tracks.length === 1 && segments.length === 1) {
              el.currentTime = 0;
              void el.play().catch(() => {});
            } else if (tracks.length === 1) {
              setSegIndex(0);
              segRef.current = 0;
              setTime(0);
              requestAnimationFrame(() =>
                void audioRef.current?.play().catch(() => {})
              );
            } else {
              go(0);
            }
          } else {
            setPlaying(false);
            persist(0, 0, speed);
          }
        }}
      />

      {/* Now playing */}
      {(tracks.length > 1 || segments.length > 1) && (
        <p className="text-center font-heading text-sm text-arcane-bright truncate">
          {track.title}
          {segments.length > 1 && (
            <span className="text-ink-dim text-xs ml-2">
              part {segIndex + 1}/{segments.length}
            </span>
          )}
        </p>
      )}

      {/* Chapters (collapsed by default so the dock stays lean) */}
      {tracks.length > 1 && chaptersOpen && (
        <ol className="max-h-44 overflow-y-auto space-y-1 pr-1 border-b border-void-border pb-3">
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
      )}

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

      {/* One row: speed | transport (true center) | repeat + volume */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          type="button"
          className="btn-ghost !px-2.5 !py-1.5 text-xs justify-self-start"
          onClick={cycleSpeed}
        >
          {speed}×
        </button>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-2 text-xs"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            aria-label="Previous chapter"
          >
            <SkipBackIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-2 text-xs"
            onClick={() => skip(-15)}
            aria-label="Back 15 seconds"
          >
            −15s
          </button>
          <button
            type="button"
            className="btn-arcane !rounded-full h-12 w-12 !p-0"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <PauseIcon className="h-5 w-5" />
            ) : (
              <PlayIcon className="h-5 w-5 translate-x-0.5" />
            )}
          </button>
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-2 text-xs"
            onClick={() => skip(15)}
            aria-label="Forward 15 seconds"
          >
            +15s
          </button>
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-2 text-xs"
            disabled={index === tracks.length - 1}
            onClick={() => go(index + 1)}
            aria-label="Next chapter"
          >
            <SkipForwardIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="justify-self-end flex items-center">
        <button
          type="button"
          className={`rounded-md px-2 py-1.5 transition-colors ${
            repeat === "off"
              ? "text-ink-dim hover:text-ink hover:bg-white/5"
              : "text-arcane-bright bg-arcane/15"
          }`}
          aria-label={
            repeat === "off"
              ? "Repeat off — tap for repeat playlist"
              : repeat === "all"
                ? "Repeat playlist — tap for repeat one"
                : "Repeat one — tap to turn off"
          }
          title={
            repeat === "off"
              ? "Repeat off"
              : repeat === "all"
                ? "Repeat playlist"
                : "Repeat one"
          }
          onClick={cycleRepeat}
        >
          {repeat === "one" ? (
            <RepeatOneIcon className="h-4 w-4" />
          ) : (
            <RepeatIcon className="h-4 w-4" />
          )}
        </button>
        {/* Volume: icon reflects the level; slider floats above on hover/click */}
        <div className="group relative flex items-center text-ink-dim">
          <button
            type="button"
            aria-label="Volume"
            aria-expanded={volumeOpen}
            className="rounded-md px-2 py-1.5 hover:text-ink hover:bg-white/5 transition-colors"
            onClick={() => setVolumeOpen((v) => !v)}
          >
            {volume === 0 ? (
              <VolumeMuteIcon className="h-4 w-4" />
            ) : volume < 0.5 ? (
              <VolumeLowIcon className="h-4 w-4" />
            ) : (
              <VolumeIcon className="h-4 w-4" />
            )}
          </button>
          <div
            className={`absolute bottom-full right-0 mb-1.5 rounded-lg border border-white/10 bg-void-raised/95 backdrop-blur px-3 py-2 shadow-xl shadow-black/40 ${
              volumeOpen ? "block" : "hidden group-hover:block"
            }`}
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label="Volume level"
              className="w-24 accent-[var(--arcane)] block"
              onChange={(e) => changeVolume(Number(e.target.value))}
            />
          </div>
        </div>
        </div>
      </div>

      {tracks.length > 1 && (
        <button
          type="button"
          className="mx-auto flex items-center gap-1.5 text-xs font-heading text-ink-dim hover:text-arcane-bright transition"
          aria-expanded={chaptersOpen}
          onClick={() => setChaptersOpen((v) => !v)}
        >
          <ChevronDownIcon
            className={`h-3.5 w-3.5 transition-transform ${chaptersOpen ? "" : "rotate-180"}`}
          />
          {chaptersOpen ? "Hide chapters" : `Chapters (${tracks.length})`}
        </button>
      )}
      </div>
    </div>
  );
}
