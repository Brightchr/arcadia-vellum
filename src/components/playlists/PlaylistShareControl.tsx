"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Owner-only visibility picker: private, friends, or everyone. */
export function PlaylistShareControl({
  playlistId,
  visibility,
}: {
  playlistId: string;
  visibility: "private" | "friends" | "public";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <label className="inline-flex items-center gap-2 text-xs text-ink-dim font-heading">
      Sharing
      <select
        className="input-arcane !w-auto !py-1 !text-xs"
        value={visibility}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          try {
            const res = await fetch(`/api/playlists/${playlistId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ visibility: e.target.value }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => null);
              window.alert(body?.error ?? "Could not update sharing.");
            } else router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        <option value="private">Only me</option>
        <option value="friends">Friends</option>
        <option value="public">Everyone</option>
      </select>
    </label>
  );
}
