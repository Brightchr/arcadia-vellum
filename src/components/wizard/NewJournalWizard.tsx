"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES, DEFAULT_THEME, isThemeId, type ThemeId } from "@/lib/themes";
import { ThemePreview } from "./ThemePreview";
import { GdocSourcePanel, type PickedDoc } from "@/components/google/GdocSourcePanel";
import { FormattingGuide } from "@/components/help/FormattingGuide";
import { HeadphonesIcon, PenIcon } from "@/components/icons";

type SourceType = "upload" | "gdoc" | "audio" | "write";

// Wizard progress survives the round-trip to Google's consent screen
// (Connect Google Drive navigates away and back).
const STORAGE_KEY = "av-new-journal";

export function NewJournalWizard({
  googleEnabled,
  seriesNames = [],
}: {
  googleEnabled: boolean;
  seriesNames?: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [volumeNumber, setVolumeNumber] = useState("");
  const [source, setSource] = useState<SourceType>("gdoc");
  const [file, setFile] = useState<File | null>(null);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [pickedDoc, setPickedDoc] = useState<PickedDoc | null>(null);
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved) {
        if (typeof saved.step === "number") setStep(Math.min(saved.step, 2));
        if (typeof saved.title === "string") setTitle(saved.title);
        if (typeof saved.subtitle === "string") setSubtitle(saved.subtitle);
        if (typeof saved.author === "string") setAuthor(saved.author);
        if (typeof saved.seriesName === "string") setSeriesName(saved.seriesName);
        if (typeof saved.volumeNumber === "string") {
          setVolumeNumber(saved.volumeNumber);
        }
        if (
          saved.source === "upload" ||
          saved.source === "gdoc" ||
          saved.source === "audio" ||
          saved.source === "write"
        ) {
          setSource(saved.source);
        }
        if (typeof saved.theme === "string" && isThemeId(saved.theme)) {
          setTheme(saved.theme);
        }
        if (saved.pickedDoc?.id && saved.pickedDoc?.name) {
          setPickedDoc(saved.pickedDoc);
        }
      }
    } catch {
      // Corrupt state - start fresh.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step,
        title,
        subtitle,
        author,
        seriesName,
        volumeNumber,
        source,
        theme,
        pickedDoc,
      })
    );
  }, [
    restored,
    step,
    title,
    subtitle,
    author,
    seriesName,
    volumeNumber,
    source,
    theme,
    pickedDoc,
  ]);

  const sourceReady =
    source === "upload"
      ? file !== null
      : source === "gdoc"
        ? pickedDoc !== null
        : source === "audio"
          ? audioFiles.length > 0
          : true; // "write" starts blank — the editor comes next

  function addAudioFiles(list: FileList | null) {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (![".mp3", ".m4a", ".ogg", ".wav"].includes(ext)) {
        setError(`"${f.name}" isn't audio we can bind. Use .mp3, .m4a, .ogg, or .wav.`);
        return;
      }
      if (f.size > 100 * 1024 * 1024) {
        setError(`"${f.name}" is over the 100 MB limit.`);
        return;
      }
      ok.push(f);
    }
    setError(null);
    setAudioFiles((prev) => [...prev, ...ok]);
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("subtitle", subtitle);
      form.set("author", author);
      form.set("seriesName", seriesName);
      form.set("volumeNumber", volumeNumber);
      form.set("theme", theme);
      form.set("sourceType", source);
      if (source === "upload" && file) form.set("file", file);
      if (source === "gdoc" && pickedDoc) form.set("gdocFileId", pickedDoc.id);

      const res = await fetch("/api/journals", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Failed to create the journal.");
        return;
      }

      const journal = body.journal;
      sessionStorage.removeItem(STORAGE_KEY);

      if (source === "audio" && audioFiles.length > 0) {
        const audioForm = new FormData();
        for (const f of audioFiles) audioForm.append("files", f);
        const audioRes = await fetch(`/api/journals/${journal.id}/audio`, {
          method: "POST",
          body: audioForm,
        });
        if (!audioRes.ok) {
          // The tome exists; send them to Settings to retry the narration.
          router.push(`/journal/${journal.id}/settings#narration`);
          return;
        }
      }

      if (source === "audio") {
        router.push(`/j/${journal.slug}/listen`);
        return;
      }

      if (source === "write") {
        router.push(`/journal/${journal.id}/write`);
        return;
      }

      if (source === "gdoc") {
        const syncRes = await fetch(`/api/journals/${journal.id}/sync`, {
          method: "POST",
        });
        if (!syncRes.ok) {
          const syncBody = await syncRes.json().catch(() => null);
          setError(
            (syncBody?.error ?? "Created, but the first sync failed.") +
              " You can retry from the dashboard."
          );
          router.push("/dashboard");
          return;
        }
      }
      router.push(`/j/${journal.slug}`);
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const steps = ["The Cover", "The Source", "The Binding"];

  return (
    <div className="panel-arcane w-full max-w-4xl p-8 md:p-10">
      <ol className="flex gap-2 mb-8 text-sm font-heading">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex-1 text-center pb-2 border-b-2 ${
              i === step
                ? "border-arcane text-arcane-bright"
                : i < step
                  ? "border-ember text-ember"
                  : "border-void-border text-ink-dim"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm mb-1 text-ink-dim">
              Journal title
            </label>
            <input
              id="title"
              className="input-arcane"
              placeholder="The Journal of Eveline Veyr"
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
              placeholder="Being a true account of the Hollowmere affair"
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
              placeholder="Eveline Veyr"
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
                Collection / series <span className="opacity-60">(optional)</span>
              </label>
              <input
                id="seriesName"
                className="input-arcane"
                placeholder="The Veyr Chronicles"
                value={seriesName}
                maxLength={80}
                list="series-names"
                onChange={(e) => setSeriesName(e.target.value)}
              />
              <datalist id="series-names">
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
                placeholder="auto"
                inputMode="numeric"
                value={volumeNumber}
                disabled={!seriesName.trim()}
                onChange={(e) =>
                  setVolumeNumber(e.target.value.replace(/\D/g, ""))
                }
              />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <FormattingGuide />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSource("gdoc")}
              className={`rounded-lg border p-4 text-left transition ${
                source === "gdoc"
                  ? "border-arcane bg-arcane/10"
                  : "border-void-border hover:border-arcane/50"
              }`}
            >
              <p className="font-heading text-base mb-1">Google Doc</p>
              <p className="text-sm text-ink-dim">
                Link a Doc and resync as you write new entries.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setSource("upload")}
              className={`rounded-lg border p-4 text-left transition ${
                source === "upload"
                  ? "border-arcane bg-arcane/10"
                  : "border-void-border hover:border-arcane/50"
              }`}
            >
              <p className="font-heading text-base mb-1">Upload a file</p>
              <p className="text-sm text-ink-dim">.docx, .md, or .txt</p>
            </button>
            <button
              type="button"
              onClick={() => setSource("write")}
              className={`rounded-lg border p-4 text-left transition ${
                source === "write"
                  ? "border-arcane bg-arcane/10"
                  : "border-void-border hover:border-arcane/50"
              }`}
            >
              <p className="font-heading text-base mb-1 inline-flex items-center gap-1.5">
                <PenIcon /> Write it here
              </p>
              <p className="text-sm text-ink-dim">
                Compose directly in Arcadia Vellum&apos;s editor.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setSource("audio")}
              className={`rounded-lg border p-4 text-left transition ${
                source === "audio"
                  ? "border-arcane bg-arcane/10"
                  : "border-void-border hover:border-arcane/50"
              }`}
            >
              <p className="font-heading text-base mb-1 inline-flex items-center gap-1.5">
                <HeadphonesIcon /> Audio only
              </p>
              <p className="text-sm text-ink-dim">
                An audiobook with a player — no text needed.
              </p>
            </button>
          </div>

          {source === "write" && (
            <p className="text-sm text-ink-dim border border-dashed border-void-border rounded-lg p-4">
              The tome starts with blank pages — you&apos;ll land in the editor
              right after binding.
            </p>
          )}

          {source === "gdoc" && (
            <GdocSourcePanel
              googleEnabled={googleEnabled}
              picked={pickedDoc}
              onPick={setPickedDoc}
            />
          )}
          {source === "upload" && (
            <label className="block border border-dashed border-void-border rounded-lg p-6 text-center cursor-pointer hover:border-arcane/60 transition">
              <input
                type="file"
                accept=".docx,.md,.markdown,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <span className="text-sm">{file.name}</span>
              ) : (
                <span className="text-sm text-ink-dim">
                  Click to choose a .docx, .md, or .txt file
                </span>
              )}
            </label>
          )}

          {source === "audio" && (
          <div>
            <p className="font-heading text-base mb-1">Narration</p>
            <p className="text-sm text-ink-dim mb-3">
              These tracks are the tome — add at least one audio file (.mp3,
              .m4a, .ogg, or .wav — max 100 MB each). They play in order, so
              one file per chapter or session works beautifully.
            </p>
            {audioFiles.length > 0 && (
              <ul className="space-y-1 mb-3">
                {audioFiles.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-3 text-sm border border-void-border rounded-lg px-3 py-1.5"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      className="btn-ghost text-xs px-2 py-0.5 !text-red-400 hover:!border-red-400 shrink-0"
                      onClick={() =>
                        setAudioFiles((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="block border border-dashed border-void-border rounded-lg p-4 text-center cursor-pointer hover:border-arcane/60 transition">
              <input
                type="file"
                accept=".mp3,.m4a,.ogg,.wav,audio/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addAudioFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <span className="inline-flex items-center justify-center gap-1.5 text-sm text-ink-dim">
                <HeadphonesIcon /> Click to add narration audio
              </span>
            </label>
          </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`rounded-lg border p-3 text-left transition ${
                theme === t.id
                  ? "border-arcane bg-arcane/10"
                  : "border-void-border hover:border-arcane/50"
              }`}
            >
              <ThemePreview themeId={t.id} sampleName={author} />
              <p className="font-heading text-base mt-3">{t.name}</p>
              <p className="text-sm text-ink-dim">{t.description}</p>
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm mt-4" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-between mt-8">
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={() => {
            if (step === 0) {
              sessionStorage.removeItem(STORAGE_KEY);
              router.push("/dashboard");
            } else {
              setStep(step - 1);
            }
          }}
        >
          {step === 0 ? "Cancel" : "Back"}
        </button>
        {step < 2 ? (
          <button
            type="button"
            className="btn-arcane"
            disabled={
              (step === 0 && !title.trim()) || (step === 1 && !sourceReady)
            }
            onClick={() => setStep(step + 1)}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="btn-arcane"
            disabled={busy}
            onClick={create}
          >
            {busy ? "Binding..." : "Bind the Tome"}
          </button>
        )}
      </div>
    </div>
  );
}
