"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Journal } from "@/lib/journals";
import { THEMES } from "@/lib/themes";
import { BookOpenIcon, HeadphonesIcon, PenIcon } from "@/components/icons";
import { volumeLabel } from "@/lib/volume";

function Chip({
  tone = "dim",
  title,
  children,
}: {
  tone?: "arcane" | "ember" | "dim";
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    arcane: "bg-arcane/15 text-arcane-bright",
    ember: "bg-ember/15 text-ember",
    dim: "bg-white/5 text-ink-dim",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function JournalCard({
  journal,
  trackCount = 0,
}: {
  journal: Journal;
  trackCount?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const themeName =
    THEMES.find((t) => t.id === journal.theme)?.name ?? journal.theme;
  const audioOnly = journal.sourceType === "audio";

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  async function call(action: string, fn: () => Promise<Response>) {
    setBusy(action);
    setError(null);
    setMenuOpen(false);
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
    setMenuOpen(false);
    if (!window.confirm(`Burn "${journal.title}"? This cannot be undone.`)) {
      return;
    }
    void call("delete", () =>
      fetch(`/api/journals/${journal.id}`, { method: "DELETE" })
    );
  };

  const menuItem =
    "block w-full text-left text-sm px-3 py-2 hover:bg-arcane/10 transition-colors";

  return (
    <div className="panel-arcane p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            className="font-heading text-base leading-snug truncate"
            title={journal.title}
          >
            {journal.title}
          </h2>
          {journal.author && (
            <p className="text-xs text-ink-dim truncate">by {journal.author}</p>
          )}
        </div>

        {/* Overflow menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-label="More actions"
            aria-expanded={menuOpen}
            disabled={busy !== null}
            onClick={() => setMenuOpen((v) => !v)}
            className={`rounded-md px-2 py-0.5 text-lg leading-none transition-colors ${
              menuOpen
                ? "bg-arcane/15 text-arcane-bright"
                : "text-ink-dim hover:text-ink hover:bg-white/5"
            }`}
          >
            &#8943;
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 w-44 py-1 rounded-lg border border-void-border bg-void-raised shadow-xl shadow-black/50">
              <Link
                href={`/journal/${journal.id}/settings`}
                className={menuItem}
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </Link>
              {audioOnly && (
                <Link
                  href={`/journal/${journal.id}/settings#narration`}
                  className={menuItem}
                  onClick={() => setMenuOpen(false)}
                >
                  {trackCount > 0 ? "Manage Audio" : "Add Audio"}
                </Link>
              )}
              {journal.sourceType === "gdoc" && (
                <button type="button" className={menuItem} onClick={resync}>
                  {busy === "resync" ? "Syncing..." : "Resync"}
                </button>
              )}
              <button
                type="button"
                className={menuItem}
                onClick={toggleVisibility}
              >
                {journal.visibility === "public" ? "Make Private" : "Make Public"}
              </button>
              {journal.visibility === "public" && (
                <button
                  type="button"
                  className={menuItem}
                  onClick={() =>
                    call("update featured", () =>
                      fetch(`/api/journals/${journal.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ featured: !journal.featured }),
                      })
                    )
                  }
                >
                  {journal.featured ? "Unfeature from Profile" : "Feature on Profile"}
                </button>
              )}
              <div className="my-1 border-t border-void-border" />
              <button
                type="button"
                className={`${menuItem} text-red-400 hover:bg-red-400/10`}
                onClick={remove}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {journal.volumeNumber !== null && (
          <Chip tone="arcane">Vol. {volumeLabel(journal)}</Chip>
        )}
        {audioOnly && trackCount > 0 && (
          <Chip
            tone="arcane"
            title={`${trackCount} track${trackCount === 1 ? "" : "s"}`}
          >
            <HeadphonesIcon className="h-3 w-3" /> {trackCount}
          </Chip>
        )}
        <Chip tone={journal.visibility === "public" ? "ember" : "dim"}>
          {journal.visibility}
        </Chip>
      </div>

      <p className="text-xs text-ink-dim">
        {themeName} ·{" "}
        {journal.sourceType === "gdoc"
          ? "Google Doc"
          : audioOnly
            ? "Audiobook"
            : journal.sourceType === "write"
              ? "Written here"
              : "Uploaded file"}
        {journal.lastSyncedAt &&
          ` · synced ${new Date(journal.lastSyncedAt).toLocaleDateString()}`}
      </p>

      {error && (
        <p className="text-red-400 text-xs" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2 mt-auto pt-1.5">
        {audioOnly ? (
          <Link
            href={`/j/${journal.slug}/listen`}
            className="btn-arcane text-xs px-3 py-1.5"
          >
            <HeadphonesIcon className="h-3.5 w-3.5" /> Listen
          </Link>
        ) : (
          <Link
            href={`/j/${journal.slug}`}
            className="btn-arcane text-xs px-3 py-1.5"
          >
            <BookOpenIcon className="h-3.5 w-3.5" /> Open Tome
          </Link>
        )}
        {journal.sourceType === "write" && (
          <Link
            href={`/journal/${journal.id}/write`}
            className="btn-ghost text-xs px-3 py-1.5"
          >
            <PenIcon className="h-3.5 w-3.5" /> Write
          </Link>
        )}
      </div>
    </div>
  );
}
