"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BanDialog } from "./BanDialog";

/** Ban/unban button for the admin inspection page. */
export function BanControls({
  userId,
  name,
  username,
  banned,
}: {
  userId: string;
  name: string;
  username: string | null;
  banned: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unban() {
    if (
      !window.confirm(
        `Unban ${name}? Their works, reviews, and profile become visible again, and any IP bans tied to the account are lifted.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, banned: false }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "That didn't work.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        className={
          banned
            ? "btn-ghost"
            : "btn-ghost !border-red-500/40 hover:!border-red-400 text-red-400"
        }
        disabled={busy}
        onClick={() => (banned ? void unban() : setDialogOpen(true))}
      >
        {busy ? "..." : banned ? "Unban" : "Ban"}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-1" role="alert">
          {error}
        </p>
      )}
      {dialogOpen && (
        <BanDialog
          user={{ id: userId, name, username }}
          onClose={() => setDialogOpen(false)}
          onBanned={() => router.refresh()}
        />
      )}
    </div>
  );
}
