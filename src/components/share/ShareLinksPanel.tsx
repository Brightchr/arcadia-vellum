"use client";

import { useCallback, useEffect, useState } from "react";

interface ShareLinkView {
  id: string;
  url: string;
  label: string;
  expiresAt: string | null;
  openCount: number;
  lastOpenedAt: string | null;
  createdAt: string;
}

const EXPIRY_OPTIONS = [
  { value: "", label: "Never expires" },
  { value: "1", label: "Expires in 1 day" },
  { value: "7", label: "Expires in 7 days" },
  { value: "30", label: "Expires in 30 days" },
  { value: "90", label: "Expires in 90 days" },
];

/**
 * Google Docs-style share links: mint named links, copy them, watch open
 * counts, and revoke any link to instantly cut off everyone who used it.
 */
export function ShareLinksPanel({
  kind,
  itemId,
}: {
  kind: "journal" | "series";
  itemId: string;
}) {
  const [links, setLinks] = useState<ShareLinkView[] | null>(null);
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/share-links?kind=${kind}&itemId=${encodeURIComponent(itemId)}`
      );
      const body = await res.json().catch(() => null);
      setLinks(Array.isArray(body?.links) ? body.links : []);
    } catch {
      setLinks([]);
    }
  }, [kind, itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          itemId,
          label,
          expiresDays: expiry ? Number(expiry) : null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Could not create the link.");
      else {
        setLabel("");
        setExpiry("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function revoke(link: ShareLinkView) {
    if (
      !window.confirm(
        `Revoke "${link.label}"? Everyone who used this link loses access immediately.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/share-links/${link.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not revoke the link.");
      } else await load();
    } finally {
      setBusy(false);
    }
  }

  function copy(link: ShareLinkView) {
    navigator.clipboard.writeText(`${window.location.origin}${link.url}`);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const expired = (l: ShareLinkView) =>
    l.expiresAt !== null && new Date(l.expiresAt) <= new Date();

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-heading">Share links</p>
        <p className="text-xs text-ink-dim">
          Anyone who opens a link can read and listen, whatever the sharing
          setting above. Revoke a link to cut off everyone who used it.
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          className="input-arcane !w-auto flex-1 min-w-40"
          placeholder='Label, e.g. "sent to my table"'
          value={label}
          maxLength={60}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select
          className="input-arcane !w-auto"
          value={expiry}
          aria-label="Link expiry"
          onChange={(e) => setExpiry(e.target.value)}
        >
          {EXPIRY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-arcane"
          disabled={busy}
          onClick={() => void create()}
        >
          New Link
        </button>
      </div>

      {links === null ? (
        <p className="text-xs text-ink-dim">Loading links...</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-ink-dim italic">
          No share links yet — mint one to let people in.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {links.map((l) => (
            <li
              key={l.id}
              className={`flex flex-wrap items-center gap-2 border border-void-border rounded-lg px-3 py-2 ${
                expired(l) ? "opacity-60" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-heading truncate">
                  {l.label}
                  {expired(l) && (
                    <span className="ml-2 text-xs text-red-400">expired</span>
                  )}
                </span>
                <span className="block text-xs text-ink-dim">
                  {l.openCount} open{l.openCount === 1 ? "" : "s"}
                  {l.lastOpenedAt
                    ? ` · last ${new Date(l.lastOpenedAt).toLocaleDateString()}`
                    : ""}
                  {l.expiresAt && !expired(l)
                    ? ` · expires ${new Date(l.expiresAt).toLocaleDateString()}`
                    : ""}
                </span>
              </span>
              <button
                type="button"
                className="btn-ghost !px-3 !py-1 text-xs"
                onClick={() => copy(l)}
              >
                {copiedId === l.id ? "Copied ✓" : "Copy"}
              </button>
              <button
                type="button"
                className="btn-ghost !px-3 !py-1 text-xs !border-red-500/40 hover:!border-red-400 text-red-400"
                disabled={busy}
                onClick={() => void revoke(l)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
