"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkKind } from "@/lib/reviews";

/** Spotify-style save/unsave toggle for a work. */
export function SaveButton({
  kind,
  itemId,
  saved: initialSaved,
  signedIn,
  compact = false,
}: {
  kind: WorkKind;
  itemId: string;
  saved: boolean;
  signedIn: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch("/api/saves", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, itemId }),
      });
      if (!res.ok) setSaved(!next);
      else router.refresh();
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={busy}
      onClick={toggle}
      className={
        compact
          ? `rounded-md p-1.5 transition-colors ${
              saved
                ? "text-arcane-bright"
                : "text-ink-dim hover:text-ink hover:bg-white/5"
            }`
          : saved
            ? "btn-arcane"
            : "btn-ghost"
      }
      title={saved ? "Remove from your saved shelf" : "Save to your shelf"}
    >
      <svg
        viewBox="0 0 24 24"
        width={compact ? 16 : 15}
        height={compact ? 16 : 15}
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0"
      >
        <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {!compact && (saved ? "Saved" : "Save")}
    </button>
  );
}
