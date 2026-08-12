"use client";

import { useEffect } from "react";

/** How often the signed-in client refreshes its "online" heartbeat. */
const BEAT_MS = 60_000;

/**
 * Invisible heartbeat: pings /api/presence once a minute while the tab is
 * open (and immediately when it regains focus) so friends' lists can show
 * who's online. Renders nothing; failures are ignored.
 */
export function PresenceBeacon() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/presence", { method: "POST" }).catch(() => {});
    };

    beat();
    timer = setInterval(beat, BEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  return null;
}
