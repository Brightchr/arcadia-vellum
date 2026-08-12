"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinGroupButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Could not join.");
        return;
      }
      router.push(`/groups/${groupId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="shrink-0 text-right">
      <button
        type="button"
        className="btn-ghost text-xs px-3 py-1.5"
        disabled={busy}
        onClick={() => void join()}
      >
        {busy ? "Joining..." : "Join"}
      </button>
      {error && <span className="block text-xs text-red-400 mt-1">{error}</span>}
    </span>
  );
}
