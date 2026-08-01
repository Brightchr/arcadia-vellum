"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Journal } from "@/lib/journals";
import { THEMES } from "@/lib/themes";

export function JournalCard({ journal }: { journal: Journal }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const themeName =
    THEMES.find((t) => t.id === journal.theme)?.name ?? journal.theme;

  async function call(action: string, fn: () => Promise<Response>) {
    setBusy(action);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Failed to ${action}`);
      } else {
        router.refresh();
      }
    } catch {
      setError(`Failed to ${action}`);
    } finally {
      setBusy(null);
    }
  }

  const toggleVisibility = () =>
    call("update visibility", () =>
      fetch(`/api/journals/${journal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility: journal.visibility === "public" ? "private" : "public",
        }),
      })
    );

  const resync = () =>
    call("resync", () =>
      fetch(`/api/journals/${journal.id}/sync`, { method: "POST" })
    );

  const remove = () => {
    if (!window.confirm(`Burn "${journal.title}"? This cannot be undone.`)) {
      return;
    }
    void call("delete", () =>
      fetch(`/api/journals/${journal.id}`, { method: "DELETE" })
    );
  };

  return (
    <div className="panel-arcane p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg leading-tight">{journal.title}</h2>
          {journal.characterName && (
            <p className="text-sm text-ink-dim">by {journal.characterName}</p>
          )}
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${
            journal.visibility === "public"
              ? "border-ember text-ember"
              : "border-void-border text-ink-dim"
          }`}
        >
          {journal.visibility}
        </span>
      </div>

      <p className="text-xs text-ink-dim">
        {themeName} ·{" "}
        {journal.sourceType === "gdoc" ? "Google Doc" : "Uploaded file"}
        {journal.lastSyncedAt &&
          ` · synced ${new Date(journal.lastSyncedAt).toLocaleString()}`}
      </p>

      {error && (
        <p className="text-red-400 text-xs" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mt-auto pt-2">
        <Link href={`/j/${journal.slug}`} className="btn-arcane text-xs px-3 py-1.5">
          Open Tome
        </Link>
        <Link
          href={`/journal/${journal.id}/settings`}
          className="btn-ghost text-xs px-3 py-1.5"
        >
          Settings
        </Link>
        {journal.sourceType === "gdoc" && (
          <button
            type="button"
            className="btn-ghost text-xs px-3 py-1.5"
            disabled={busy !== null}
            onClick={resync}
          >
            {busy === "resync" ? "Syncing..." : "Resync"}
          </button>
        )}
        <button
          type="button"
          className="btn-ghost text-xs px-3 py-1.5"
          disabled={busy !== null}
          onClick={toggleVisibility}
        >
          {journal.visibility === "public" ? "Make Private" : "Make Public"}
        </button>
        <button
          type="button"
          className="btn-ghost text-xs px-3 py-1.5 !text-red-400 hover:!border-red-400"
          disabled={busy !== null}
          onClick={remove}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
