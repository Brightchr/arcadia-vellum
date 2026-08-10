"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Journal } from "@/lib/journals";
import { THEMES, type ThemeId } from "@/lib/themes";
import { ThemePreview } from "@/components/wizard/ThemePreview";
import { GdocSourcePanel, type PickedDoc } from "@/components/google/GdocSourcePanel";
import { FormattingGuide } from "@/components/help/FormattingGuide";
import { ShareLinksPanel } from "@/components/share/ShareLinksPanel";
import { CoverLayoutEditor } from "@/components/settings/CoverLayoutEditor";

export interface TrackInfo {
  id: string;
  title: string;
  /** Number of files that make up this entry (played back-to-back). */
  parts?: number;
  /** Chapter image id, shown while this entry plays. */
  coverImageId?: string | null;
}

export function SettingsForm({
  journal,
  googleEnabled,
  seriesName: initialSeriesName = "",
  seriesNames = [],
  tracks = [],
  tagNames = [],
}: {
  journal: Journal;
  googleEnabled: boolean;
  seriesName?: string;
  seriesNames?: string[];
  tracks?: TrackInfo[];
  tagNames?: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(journal.title);
  const [subtitle, setSubtitle] = useState(journal.subtitle ?? "");
  const [author, setAuthor] = useState(journal.author ?? "");
  const [seriesName, setSeriesName] = useState(initialSeriesName);
  const [volumeNumber, setVolumeNumber] = useState(
    journal.volumeNumber !== null ? String(journal.volumeNumber) : ""
  );
  const [partNumber, setPartNumber] = useState(
    journal.partNumber !== null ? String(journal.partNumber) : ""
  );
  const [theme, setTheme] = useState(journal.theme as ThemeId);
  const [pickedDoc, setPickedDoc] = useState<PickedDoc | null>(null);
  const [tagsInput, setTagsInput] = useState(tagNames.join(", "));
  const [description, setDescription] = useState(journal.description ?? "");
  const [visibility, setVisibility] = useState<string>(journal.visibility);
  const [listed, setListed] = useState(journal.listed);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [combineFiles, setCombineFiles] = useState(false);
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
    const part = parseInt(partNumber, 10);
    await patch(
      {
        title,
        subtitle,
        author,
        seriesName,
        volumeNumber: Number.isFinite(vol) && vol > 0 ? vol : null,
        partNumber: Number.isFinite(part) && part > 0 ? part : null,
        description,
      },
      "details"
    );
  }

  async function saveTheme(next: ThemeId) {
    setTheme(next);
    await patch({ theme: next }, "theme");
  }

  async function saveSharing() {
    await patch({ visibility, listed }, "visibility");
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
      if (combineFiles && files.length > 1) {
        form.set("combine", "true");
        const name = window.prompt(
          "Title for this entry (its files will play as one chapter):",
          files[0].name.replace(/\.[^.]+$/, "")
        );
        if (name === null) return;
        if (name.trim()) form.set("entryTitle", name.trim());
      }
      const res = await fetch(`/api/journals/${journal.id}/audio`, {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Upload failed.");
      else {
        setNotice(
          combineFiles && files.length > 1
            ? `Added 1 entry with ${files.length} parts.`
            : `Added ${body.tracks.length} track${body.tracks.length === 1 ? "" : "s"}.`
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

  async function saveTags() {
    setBusy("tags");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/journals/${journal.id}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Could not save tags.");
      else {
        setTagsInput((body.tags as string[]).join(", "));
        setNotice("Tags saved.");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function setChapterImage(trackId: string, f: File | null | undefined) {
    if (!f) return;
    setBusy("narration");
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", f);
      const res = await fetch(
        `/api/journals/${journal.id}/audio/${trackId}/cover`,
        { method: "POST", body: form }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Upload failed.");
      else {
        setNotice("Chapter image set.");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function removeChapterImage(trackId: string) {
    setBusy("narration");
    setError(null);
    try {
      const res = await fetch(
        `/api/journals/${journal.id}/audio/${trackId}/cover`,
        { method: "DELETE" }
      );
      if (res.ok) router.refresh();
      else setError("Could not remove the chapter image.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadCover(f: File | null | undefined) {
    if (!f) return;
    setBusy("cover");
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.set("file", f);
      const res = await fetch(`/api/journals/${journal.id}/cover`, {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Upload failed.");
      else {
        setNotice("Cover set.");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function removeCover() {
    setBusy("cover");
    setError(null);
    try {
      const res = await fetch(`/api/journals/${journal.id}/cover`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotice("Cover removed.");
        router.refresh();
      } else setError("Could not remove the cover.");
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
        <div>
          <label
            htmlFor="description"
            className="block text-sm mb-1 text-ink-dim"
          >
            Description{" "}
            <span className="opacity-60">
              (what it&apos;s about — shown on the tome&apos;s homepage)
            </span>
          </label>
          <textarea
            id="description"
            className="input-arcane min-h-24 resize-y"
            value={description}
            maxLength={2000}
            placeholder="A campaign diary of the Hollowmere affair — marsh horror, found family, and a debt to something old."
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem_6rem]">
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
          <div>
            <label
              htmlFor="partNumber"
              className="block text-sm mb-1 text-ink-dim"
              title="Chapter/part within the volume — shows as Vol. 1.2"
            >
              Part #
            </label>
            <input
              id="partNumber"
              className="input-arcane"
              inputMode="numeric"
              placeholder="—"
              value={partNumber}
              disabled={!seriesName.trim() || !volumeNumber.trim()}
              onChange={(e) =>
                setPartNumber(e.target.value.replace(/\D/g, ""))
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

      {/* Tags */}
      <section className="panel-arcane p-6 space-y-3">
        <h2 className="font-heading text-lg">Tags</h2>
        <p className="text-sm text-ink-dim">
          Up to 8 comma-separated tags to help readers find this tome on the
          browse page (kept family-friendly — unsafe words are rejected).
        </p>
        <input
          className="input-arcane"
          value={tagsInput}
          placeholder="fantasy, campaign diary, horror"
          onChange={(e) => setTagsInput(e.target.value)}
        />
        <button
          type="button"
          className="btn-arcane"
          disabled={busy !== null}
          onClick={saveTags}
        >
          {busy === "tags" ? "Saving..." : "Save Tags"}
        </button>
      </section>

      {/* Sharing */}
      <section className="panel-arcane p-6 space-y-4">
        <h2 className="font-heading text-lg">Sharing &amp; Access</h2>
        <div>
          <label htmlFor="visibility" className="block text-sm mb-1 text-ink-dim">
            Who can open this tome
          </label>
          <select
            id="visibility"
            className="input-arcane !w-auto"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="public">Everyone</option>
            <option value="friends">Friends only</option>
            <option value="restricted">By request — readers ask, you approve</option>
            <option value="private">Only me</option>
          </select>
          <p className="text-xs text-ink-dim mt-1">
            {visibility === "restricted"
              ? "The homepage (cover, description, tags) is visible; the pages and audio unlock per reader you approve. Requests appear on the tome's homepage and in your notifications."
              : visibility === "friends"
                ? "Only your accepted friends can open it. It never appears in Browse."
                : visibility === "private"
                  ? "Invisible to everyone but you — except people you give a share link below."
                  : "Anyone can open it while it's shown in Browse. Untick below to make it share-link-only."}
          </p>
        </div>
        {(visibility === "public" || visibility === "restricted") && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={listed}
              onChange={(e) => setListed(e.target.checked)}
            />
            Show in Browse &amp; search
            <span className="text-xs text-ink-dim">
              (unchecked = unlisted — only share links below open it)
            </span>
          </label>
        )}
        <button
          type="button"
          className="btn-arcane"
          disabled={
            busy !== null ||
            (visibility === journal.visibility && listed === journal.listed)
          }
          onClick={saveSharing}
        >
          {busy === "visibility" ? "Saving..." : "Save Sharing"}
        </button>
        {journal.visibility === "public" && journal.listed && (
          <div className="flex gap-2">
            <input className="input-arcane flex-1" readOnly value={shareUrl} />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                setNotice("Link copied.");
              }}
            >
              Copy
            </button>
          </div>
        )}

        <div className="border-t border-void-border pt-4">
          <ShareLinksPanel kind="journal" itemId={journal.id} />
        </div>
      </section>

      {/* Narration — audio-only tomes are made of these tracks */}
      {journal.sourceType === "audio" && (
      <section id="narration" className="panel-arcane p-6 space-y-4 scroll-mt-6">
        <h2 className="font-heading text-lg">Narration</h2>
        <p className="text-sm text-ink-dim">
          The audio tracks of this tome (.mp3, .m4a, .ogg, or .wav — e.g.
          rendered with ElevenLabs). They play in order, so one file per
          chapter or session works beautifully.
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
                  {(t.parts ?? 1) > 1 && (
                    <span className="text-ink-dim text-xs ml-2">
                      ({t.parts} parts)
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {t.coverImageId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/images/${t.coverImageId}`}
                      alt=""
                      className="h-8 w-8 rounded object-cover border border-void-border"
                    />
                  )}
                  <label
                    className="btn-ghost text-xs px-2 py-1 cursor-pointer"
                    title="Chapter image — shown while this entry plays"
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      disabled={busy !== null}
                      onChange={(e) => {
                        void setChapterImage(t.id, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {t.coverImageId ? "Image" : "+ Image"}
                  </label>
                  {t.coverImageId && (
                    <button
                      type="button"
                      className="btn-ghost text-xs px-2 py-1"
                      title="Remove chapter image"
                      disabled={busy !== null}
                      onClick={() => removeChapterImage(t.id)}
                    >
                      ⨯ img
                    </button>
                  )}
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

        <label className="flex items-center gap-2 text-sm text-ink-dim cursor-pointer">
          <input
            type="checkbox"
            className="accent-[var(--arcane)]"
            checked={combineFiles}
            onChange={(e) => setCombineFiles(e.target.checked)}
          />
          Combine selected files into a single entry (they play back-to-back
          as one chapter — handy when a long reading comes as several files)
        </label>
      </section>
      )}

      {/* Cover art — replaces the themed cover; text placement is editable */}
      <section className="panel-arcane p-6 space-y-4">
        <h2 className="font-heading text-lg">Cover Art</h2>
        <p className="text-sm text-ink-dim">
          {journal.sourceType === "audio"
            ? "Album art while this volume plays — in series and playlists too — and the cover on Browse cards."
            : "Artwork for the front cover of the tome, also shown on Browse cards. Without art the cover keeps its themed look."}
        </p>
        {journal.coverImageId && (
          <CoverLayoutEditor
            key={journal.coverImageId}
            coverUrl={`/api/images/${journal.coverImageId}`}
            title={title}
            subtitle={subtitle || null}
            author={author || null}
            layout={journal.coverLayout}
            aspect={journal.sourceType === "audio" ? "audio" : "book"}
            disabled={busy !== null}
            onSave={(layout) => patch({ coverLayout: layout }, "coverLayout")}
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-arcane cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              disabled={busy !== null}
              onChange={(e) => {
                void uploadCover(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {busy === "cover"
              ? "Working..."
              : journal.coverImageId
                ? "Replace Cover Art"
                : "Upload Cover Art"}
          </label>
          {journal.coverImageId && (
            <button
              type="button"
              className="btn-ghost"
              disabled={busy !== null}
              onClick={removeCover}
            >
              Remove
            </button>
          )}
        </div>
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
        ) : journal.sourceType === "write" ? (
          <>
            <p className="text-sm text-ink-dim">
              Written in Vellum&apos;s editor.
              {journal.lastSyncedAt &&
                ` Last saved ${new Date(journal.lastSyncedAt).toLocaleString()}.`}
            </p>
            <a href={`/journal/${journal.id}/write`} className="btn-arcane">
              Open the Editor
            </a>
          </>
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
