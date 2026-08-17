"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BAN_REASONS, type BanReasonCode } from "@/lib/ban-reasons";

/**
 * Take a work down (with a reason the owner will see) or restore it.
 * Rendered per row in the admin inspection page's works table.
 */
export function WorkBanButton({
  journalId,
  title,
  banned,
}: {
  journalId: string;
  title: string;
  banned: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<BanReasonCode>("guidelines");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextBanned: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalId, banned: nextBanned, reason }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "That didn't work.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (banned) {
    return (
      <button
        type="button"
        className="btn-ghost !px-2.5 !py-1 text-xs"
        disabled={busy}
        onClick={() => {
          if (window.confirm(`Restore "${title}" to the store?`)) {
            void submit(false);
          }
        }}
      >
        {busy ? "..." : "Restore"}
      </button>
    );
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="btn-ghost !px-2.5 !py-1 text-xs !border-red-500/40 hover:!border-red-400 text-red-400"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
      >
        Ban Work
      </button>
      {open && (
        <span className="absolute right-0 top-full mt-1 z-20 block w-64 rounded-lg border border-void-border bg-void-raised p-3 shadow-xl shadow-black/50 text-left">
          <label className="block text-xs text-ink-dim mb-1">
            Reason (shown to the owner)
          </label>
          <select
            className="input-arcane !text-xs"
            value={reason}
            onChange={(e) => setReason(e.target.value as BanReasonCode)}
          >
            {Object.entries(BAN_REASONS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          {error && (
            <span className="block text-xs text-red-400 mt-1" role="alert">
              {error}
            </span>
          )}
          <span className="flex justify-end gap-1.5 mt-2">
            <button
              type="button"
              className="btn-ghost !px-2.5 !py-1 text-xs"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-ghost !px-2.5 !py-1 text-xs !border-red-500/40 hover:!border-red-400 text-red-400"
              onClick={() => void submit(true)}
              disabled={busy}
            >
              {busy ? "..." : "Remove from View"}
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
