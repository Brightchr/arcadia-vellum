"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Journal } from "@/lib/journals";
import { THEMES, type ThemeId } from "@/lib/themes";
import { ThemePreview } from "@/components/wizard/ThemePreview";
import { GdocSourcePanel, type PickedDoc } from "@/components/google/GdocSourcePanel";
import { FormattingGuide } from "@/components/help/FormattingGuide";

export interface TrackInfo {
  id: string;
  title: string;
}

export function SettingsForm({
  journal,
  googleEnabled,
  seriesName: initialSeriesName = "",
  seriesNames = [],
  tracks = [],
}: {
  journal: Journal;
  googleEnabled: boolean;
  seriesName?: string;
  seriesNames?: string[];
  tracks?: TrackInfo[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(journal.title);
  const [subtitle, setSubtitle] = useState(journal.subtitle ?? "");
  const [author, setAuthor] = useState(journal.author ?? "");
  const [seriesName, setSeriesName] = useState(initialSeriesName);
  const [volumeNumber, setVolumeNumber] = useState(
    journal.volumeNumber !== null ? String(journal.volumeNumber) : ""
  );
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
    const vol = parseInt(volumeNumber, 10);
    await patch(
      {
        title,
        subtitle,
        author,
        seriesName,
        volumeNumber: Number.isFinite(vol) && vol > 0 ? vol : null,
      },
      "details"
    );
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

  async function uploadNarration(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy("narration");
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      const res = await fetch(`/api/journals/${journal.id}/audio`, {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Upload failed.");
      else {
        setNotice(
          `Added ${body.tracks.length} track${body.tracks.length === 1 ? "" : "s"}.`
        );
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function deleteNarration(trackId: string) {
    setBusy("narration");
    setError(null);
    try {
      const res = await fetch(`/api/journals/${journal.id}/audio/${trackId}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
      else setError("Could not remove the track.");
    } finally {
      setBusy(null);
    }
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
          <label htmlFor="subtitle" className="block text-sm mb-1 text-ink-dim">
            Subtitle <span className="opacity-60">(optional)</span>
          </label>
          <input
            id="subtitle"
            className="input-arcane"
            value={subtitle}
            maxLength={160}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="author" className="block text-sm mb-1 text-ink-dim">
            Author <span className="opacity-60">(optional)</span>
          </label>
          <input
            id="author"
            className="input-arcane"
            value={author}
            maxLength={80}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div>
            <label
              htmlFor="seriesName"
              className="block text-sm mb-1 text-ink-dim"
            >
              Collection / series{" "}
              <span className="opacity-60">(blank to unshelve)</span>
            </label>
            <input
              id="seriesName"
              className="input-arcane"
              value={seriesName}
              maxLength={80}
              list="settings-series-names"
              onChange={(e) => setSeriesName(e.target.value)}
            />
            <datalist id="settings-series-names">
              {seriesNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label
              htmlFor="volumeNumber"
              className="block text-sm mb-1 text-ink-dim"
            >
              Volume #
            </label>
            <input
              id="volumeNumber"
              className="input-arcane"
              inputMode="numeric"
              placeholder="auto"
              value={volumeNumber}
              disabled={!seriesName.trim()}
              onChange={(e) =>
                setVolumeNumber(e.target.value.replace(/\D/g, ""))
              }
            />
          </div>
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
              <ThemePreview themeId={t.id} sampleName={author} />
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

      {/* Narration */}
      <section id="narration" className="panel-arcane p-6 space-y-4 scroll-mt-6">
        <h2 className="font-heading text-lg">Narration</h2>
        <p className="text-sm text-ink-dim">
          Upload audio readings of your journal (.mp3, .m4a, .ogg, or .wav —
          e.g. rendered with ElevenLabs). Anyone who can read the tome gets a
          player; multiple files play in order, so one file per session works
          beautifully.
        </p>

        {tracks.length > 0 && (
          <ul className="space-y-2">
            {tracks.map((t, i) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 border border-void-border rounded-lg px-3 py-2"
              >
                <span className="text-sm truncate">
                  <span className="text-ink-dim font-heading text-xs mr-2">
                    {i + 1}.
                  </span>
                  {t.title}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <audio
                    src={`/api/audio/${t.id}`}
                    controls
                    preload="none"
                    className="h-8 w-40 hidden sm:block"
                  />
                  <button
                    type="button"
                    className="btn-ghost text-xs px-2 py-1 !text-red-400 hover:!border-red-400"
                    disabled={busy !== null}
                    onClick={() => deleteNarration(t.id)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <label className="block border border-dashed border-void-border rounded-lg p-5 text-center cursor-pointer hover:border-arcane/60 transition">
          <input
            type="file"
            accept=".mp3,.m4a,.ogg,.wav,audio/*"
            multiple
            className="hidden"
            disabled={busy !== null}
            onChange={(e) => {
              void uploadNarration(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="text-sm text-ink-dim">
            {busy === "narration"
              ? "Uploading..."
              : "Click to add narration audio (max 100 MB per file)"}
          </span>
        </label>
      </section>

      {/* Source */}
      <section className="panel-arcane p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg">Source</h2>
          <FormattingGuide />
        </div>
        {journal.sourceType === "audio" ? (
          <p className="text-sm text-ink-dim">
            This is an audio-only tome — the narration tracks above are its
            content. Readers get the audiobook player instead of pages.
          </p>
        ) : journal.sourceType === "gdoc" ? (
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
