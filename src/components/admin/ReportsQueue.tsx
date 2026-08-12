"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: "open" | "dismissed" | "upheld";
  createdAt: string;
  reportedId: string;
  reportedName: string;
  reportedUsername: string | null;
  reportedBanned: boolean;
  reporterName: string;
  reporterUsername: string | null;
  groupName: string | null;
}

const REASON_LABEL: Record<string, string> = {
  spam: "Spam / bot activity",
  harassment: "Harassment",
  inappropriate: "Inappropriate content",
  other: "Other",
};

const STATUS_CLASS: Record<ReportRow["status"], string> = {
  open: "bg-ember/20 text-ember",
  dismissed: "bg-overlay-strong text-ink-dim",
  upheld: "bg-red-400/15 text-red-400",
};

/**
 * The moderation inbox: reports escalated from group bans. While a report is
 * open the reported user is muted platform-wide — resolve promptly.
 */
export function ReportsQueue({ reports }: { reports: ReportRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(
    id: string,
    outcome: "dismissed" | "upheld",
    ban: boolean
  ) {
    if (busy) return;
    if (ban && !window.confirm("Uphold the report AND platform-ban this user?"))
      return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, outcome, ban: ban || undefined }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Could not resolve the report.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (reports.length === 0) {
    return (
      <p className="text-sm text-ink-dim italic">
        No reports — the realm is at peace.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {reports.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-void-border p-3 space-y-2"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider ${STATUS_CLASS[r.status]}`}
            >
              {r.status}
            </span>
            <Link
              href={`/admin/users/${r.reportedId}`}
              className="font-heading text-arcane-bright hover:underline"
            >
              {r.reportedName}
            </Link>
            {r.reportedUsername && (
              <span className="text-xs text-ink-dim">@{r.reportedUsername}</span>
            )}
            {r.reportedBanned && (
              <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider text-red-400">
                Banned
              </span>
            )}
            <span className="ml-auto text-xs text-ink-dim">
              {new Date(r.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm">
            <span className="text-ink-dim">Reason:</span>{" "}
            {REASON_LABEL[r.reason] ?? r.reason}
            {r.groupName && (
              <span className="text-ink-dim"> · in “{r.groupName}”</span>
            )}
            <span className="text-ink-dim">
              {" "}
              · reported by {r.reporterName}
              {r.reporterUsername ? ` (@${r.reporterUsername})` : ""}
            </span>
          </p>
          {r.details && (
            <p className="rounded bg-overlay px-2.5 py-1.5 text-sm text-ink-dim">
              “{r.details}”
            </p>
          )}
          {r.status === "open" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="btn-ghost text-xs px-3 py-1.5"
                disabled={busy !== null}
                onClick={() => void resolve(r.id, "dismissed", false)}
              >
                Dismiss (lift mute)
              </button>
              <button
                type="button"
                className="btn-ghost text-xs px-3 py-1.5"
                disabled={busy !== null}
                onClick={() => void resolve(r.id, "upheld", false)}
              >
                Uphold
              </button>
              <button
                type="button"
                className="btn-ghost text-xs px-3 py-1.5 !border-red-400/40 !text-red-400 hover:!bg-red-400/10"
                disabled={busy !== null}
                onClick={() => void resolve(r.id, "upheld", true)}
              >
                Uphold + Ban
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
