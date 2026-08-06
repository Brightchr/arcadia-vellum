"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PenIcon } from "@/components/icons";

/** Inline rename + delete for a playlist header. */
export function PlaylistTitleControls({
  playlistId,
  name,
}: {
  playlistId: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <h1 className="font-display text-2xl text-arcane-bright inline-flex items-center gap-2">
      {name}
      <button
        type="button"
        aria-label="Rename playlist"
        className="text-ink-dim hover:text-arcane-bright transition p-1"
        disabled={busy}
        onClick={async () => {
          const next = window.prompt("Rename this playlist:", name)?.trim();
          if (!next || next === name) return;
          setBusy(true);
          try {
            const res = await fetch(`/api/playlists/${playlistId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: next }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => null);
              window.alert(body?.error ?? "Rename failed.");
            } else router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        <PenIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Delete playlist"
        className="text-ink-dim hover:text-red-400 transition p-1 text-sm"
        disabled={busy}
        onClick={async () => {
          if (!window.confirm(`Delete the playlist "${name}"?`)) return;
          setBusy(true);
          await fetch(`/api/playlists/${playlistId}`, { method: "DELETE" });
          router.push("/dashboard");
          router.refresh();
        }}
      >
        ✕
      </button>
    </h1>
  );
}
