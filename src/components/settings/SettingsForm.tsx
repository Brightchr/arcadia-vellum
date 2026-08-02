"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Journal } from "@/lib/journals";
import { THEMES, type ThemeId } from "@/lib/themes";
import { ThemePreview } from "@/components/wizard/ThemePreview";
import { GdocSourcePanel, type PickedDoc } from "@/components/google/GdocSourcePanel";
import { FormattingGuide } from "@/components/help/FormattingGuide";

export function SettingsForm({
  journal,
  googleEnabled,
}: {
  journal: Journal;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(journal.title);
  const [characterName, setCharacterName] = useState(journal.characterName ?? "");
  const [theme, setTheme] = useState(journal.theme as ThemeId);
  const [pickedDoc, setPickedDoc] = useState<PickedDoc | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/j/${journal.slug}`
      : `/j/${journal.slug}`;

  async function patch(payload: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/journals/${journal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Update failed.");
        return false;
      }
      setNotice("Saved.");
      router.refresh();
      return true;
    } catch {
      setError("Update failed.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveDetails() {
    await patch({ title, characterName }, "details");
  }

  async function saveTheme(next: ThemeId) {
    setTheme(next);
    await patch({ theme: next }, "theme");
  }

  async function toggleVisibility() {
    await patch(
      { visibility: journal.visibility === "public" ? "private" : "public" },
      "visibility"
    );
  }

  async function resync() {
    setBusy("sync");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/journals/${journal.id}/sync`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Sync failed.");
      else {
        setNotice("Synced from Google Docs.");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function relinkDoc(doc: PickedDoc | null) {
    setPickedDoc(doc);
    if (!doc) return;
    const ok = await patch({ gdocFileId: doc.id }, "relink");
    if (ok) await resync();
  }

  async function reupload() {
    if (!file) return;
    setBusy("upload");
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/journals/${journal.id}/upload`, {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Upload failed.");
      else {
        setNotice("Content replaced.");
        setFile(null);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(`Burn "${journal.title}"? This cannot be undone.`)) {
      return;
    }
    setBusy("delete");
    const res = await fetch(`/api/journals/${journal.id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
    else {
      setError("Delete failed.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      {(notice || error) && (
        <p
          className={`text-sm ${error ? "text-red-400" : "text-ember"}`}
          role="status"
        >
          {error ?? notice}
        </p>
      )}

      {/* Details */}
      <section className="panel-arcane p-6 space-y-4">
        <h2 className="font-heading text-lg">Cover Details</h2>
        <div>
          <label htmlFor="title" className="block text-sm mb-1 text-ink-dim">
            Journal title
          </label>
          <input
            id="title"
            className="input-arcane"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label
            htmlFor="characterName"
            className="block text-sm mb-1 text-ink-dim"
          >
            Character name
          </label>
          <input
            id="characterName"
            className="input-arcane"
            value={characterName}
            maxLength={80}
            onChange={(e) => setCharacterName(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-arcane"
          disabled={busy !== null || !title.trim()}
          onClick={saveDetails}
        >
          {busy === "details" ? "Saving..." : "Save Details"}
        </button>
      </section>

      {/* Theme */}
      <section className="panel-arcane p-6">
        <h2 className="font-heading text-lg mb-4">Binding Theme</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.id}
              disabled={busy !== null}
              onClick={() => saveTheme(t.id)}
              className={`rounded-lg border p-3 text-left transition ${
                theme === t.id
                  ? "border-arcane bg-arcane/10"
                  : "border-void-border hover:border-arcane/50"
              }`}
            >
              <ThemePreview themeId={t.id} characterName={characterName} />
              <p className="font-heading text-sm mt-3">{t.name}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Sharing */}
      <section className="panel-arcane p-6 space-y-3">
        <h2 className="font-heading text-lg">Sharing</h2>
        <p className="text-sm text-ink-dim">
          {journal.visibility === "public"
            ? "This link is live — anyone who has it can read the tome in its binding, no account needed."
            : "This will be the share link. It stays locked (404 for everyone but you) until you make the tome public."}
        </p>
        <div className="flex gap-2">
          <input
            className={`input-arcane flex-1 ${
              journal.visibility === "public" ? "" : "opacity-60"
            }`}
            readOnly
            value={shareUrl}
          />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              setNotice(
                journal.visibility === "public"
                  ? "Link copied."
                  : "Link copied — remember to make the tome public before sending it."
              );
            }}
          >
            Copy
          </button>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={busy !== null}
          onClick={toggleVisibility}
        >
          {journal.visibility === "public" ? "Make Private" : "Make Public"}
        </button>
      </section>

      {/* Source */}
      <section className="panel-arcane p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg">Source</h2>
          <FormattingGuide />
        </div>
        {journal.sourceType === "gdoc" ? (
          <>
            <p className="text-sm text-ink-dim">
              Linked to a Google Doc.
              {journal.lastSyncedAt &&
                ` Last synced ${new Date(journal.lastSyncedAt).toLocaleString()}.`}
            </p>
            <button
              type="button"
              className="btn-arcane"
              disabled={busy !== null}
              onClick={resync}
            >
              {busy === "sync" ? "Syncing..." : "Resync Now"}
            </button>
            <div>
              <p className="text-sm text-ink-dim mb-2">
                Link a different document:
              </p>
              <GdocSourcePanel
                googleEnabled={googleEnabled}
                picked={pickedDoc}
                onPick={relinkDoc}
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-dim">
              Content comes from an uploaded file. Upload a new version to
              replace it.
            </p>
            <label className="block border border-dashed border-void-border rounded-lg p-5 text-center cursor-pointer hover:border-arcane/60 transition">
              <input
                type="file"
                accept=".docx,.md,.markdown,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-sm text-ink-dim">
                {file ? file.name : "Choose a .docx, .md, or .txt file"}
              </span>
            </label>
            <button
              type="button"
              className="btn-arcane"
              disabled={busy !== null || !file}
              onClick={reupload}
            >
              {busy === "upload" ? "Replacing..." : "Replace Content"}
            </button>
          </>
        )}
      </section>

      {/* Danger */}
      <section className="panel-arcane p-6 space-y-3 border-red-900/40">
        <h2 className="font-heading text-lg text-red-400">The Pyre</h2>
        <p className="text-sm text-ink-dim">
          Burning a tome destroys it and its content permanently.
        </p>
        <button
          type="button"
          className="btn-ghost !text-red-400 hover:!border-red-400"
          disabled={busy !== null}
          onClick={remove}
        >
          {busy === "delete" ? "Burning..." : "Burn This Tome"}
        </button>
      </section>
    </div>
  );
}
