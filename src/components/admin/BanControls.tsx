"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [error, setError] = useState<string | null>(null);

  async function act() {
    const next = !banned;
    if (
      !window.confirm(
        next
          ? `Ban ${name}${username ? ` (@${username})` : ""}? Their works, reviews, and profile will be hidden, and everyone who saved their work will be notified.`
          : `Unban ${name}? Their works, reviews, and profile become visible again.`
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
        body: JSON.stringify({ userId, banned: next }),
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
        onClick={() => void act()}
      >
        {busy ? "..." : banned ? "Unban" : "Ban"}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
