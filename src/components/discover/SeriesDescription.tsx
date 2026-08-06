"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PenIcon } from "@/components/icons";

/** The series blurb, editable inline by its owner. */
export function SeriesDescription({
  seriesId,
  description,
  isOwner,
}: {
  seriesId: string;
  description: string | null;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOwner && !description) return null;

  if (editing) {
    return (
      <div className="space-y-2 max-w-xl">
        <textarea
          className="input-arcane min-h-24 resize-y"
          value={draft}
          maxLength={2000}
          placeholder="What is this series about?"
          onChange={(e) => setDraft(e.target.value)}
        />
        {error && (
          <p className="text-red-400 text-xs" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-arcane text-xs px-3 py-1.5"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const res = await fetch(`/api/series/${seriesId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ description: draft }),
                });
                const body = await res.json().catch(() => null);
                if (!res.ok) setError(body?.error ?? "Could not save.");
                else {
                  setEditing(false);
                  router.refresh();
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="btn-ghost text-xs px-3 py-1.5"
            disabled={busy}
            onClick={() => {
              setDraft(description ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      {description ? (
        <p className="text-sm whitespace-pre-wrap inline">{description}</p>
      ) : (
        <span className="text-sm text-ink-dim italic">
          No description yet.
        </span>
      )}
      {isOwner && (
        <button
          type="button"
          aria-label="Edit series description"
          className="ml-2 align-middle text-ink-dim hover:text-arcane-bright transition"
          onClick={() => setEditing(true)}
        >
          <PenIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
