"use client";

import { useState } from "react";
import { BAN_REASONS, type BanReasonCode } from "@/lib/ban-reasons";

const DURATIONS = [
  { value: "", label: "Permanent" },
  { value: "1", label: "24 hours" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
] as const;

/**
 * Ban confirmation dialog: pick a built-in reason (shown to the user when
 * they try to sign in), an optional duration, and whether to also ban the
 * account's known IP addresses.
 */
export function BanDialog({
  user,
  onClose,
  onBanned,
}: {
  user: { id: string; name: string; username: string | null };
  onClose: () => void;
  onBanned: () => void;
}) {
  const [reason, setReason] = useState<BanReasonCode>("guidelines");
  const [days, setDays] = useState<string>("");
  const [banIps, setBanIps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          banned: true,
          reason,
          days: days ? Number(days) : undefined,
          banIps,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "That didn't work.");
        return;
      }
      onBanned();
      onClose();
    } catch {
      setError("That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Ban ${user.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-arcane w-full max-w-md p-6 space-y-4">
        <div>
          <h2 className="font-display text-xl text-arcane-bright">
            Ban {user.name}
            {user.username ? ` (@${user.username})` : ""}
          </h2>
          <p className="text-sm text-ink-dim mt-1">
            Their works, reviews, and profile are hidden, they're signed out
            everywhere, and the reason below is shown if they try to sign in.
            Everyone who saved their work is notified.
          </p>
        </div>

        <div>
          <label htmlFor="ban-reason" className="block text-sm mb-1 text-ink-dim">
            Reason (shown to the user)
          </label>
          <select
            id="ban-reason"
            className="input-arcane"
            value={reason}
            onChange={(e) => setReason(e.target.value as BanReasonCode)}
          >
            {Object.entries(BAN_REASONS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ban-days" className="block text-sm mb-1 text-ink-dim">
            Duration
          </label>
          <select
            id="ban-days"
            className="input-arcane"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={banIps}
            onChange={(e) => setBanIps(e.target.checked)}
          />
          <span>
            Also ban their known IP addresses
            <span className="block text-xs text-ink-dim">
              Sign-in and sign-up are refused from every network this account
              has signed in from. Lifted automatically if you unban them.
            </span>
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-ghost text-sm !border-red-500/40 hover:!border-red-400 text-red-400"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? "Banning..." : days ? "Suspend" : "Ban Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
