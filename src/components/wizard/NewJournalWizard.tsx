"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { THEMES, DEFAULT_THEME, type ThemeId } from "@/lib/themes";
import { ThemePreview } from "./ThemePreview";
import { GdocSourcePanel, type PickedDoc } from "@/components/google/GdocSourcePanel";

type SourceType = "upload" | "gdoc";

export function NewJournalWizard({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [source, setSource] = useState<SourceType>("gdoc");
  const [file, setFile] = useState<File | null>(null);
  const [pickedDoc, setPickedDoc] = useState<PickedDoc | null>(null);
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sourceReady = source === "upload" ? file !== null : pickedDoc !== null;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("characterName", characterName);
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
    <div className="panel-arcane w-full max-w-3xl p-8">
      <ol className="flex gap-2 mb-8 text-xs font-heading">
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
            <label
              htmlFor="characterName"
              className="block text-sm mb-1 text-ink-dim"
            >
              Character name <span className="opacity-60">(optional)</span>
            </label>
            <input
              id="characterName"
              className="input-arcane"
              placeholder="Eveline Veyr"
              value={characterName}
              maxLength={80}
              onChange={(e) => setCharacterName(e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSource("gdoc")}
              className={`rounded-lg border p-4 text-left transition ${
                source === "gdoc"
                  ? "border-arcane bg-arcane/10"
                  : "border-void-border hover:border-arcane/50"
              }`}
            >
              <p className="font-heading text-sm mb-1">Google Doc</p>
              <p className="text-xs text-ink-dim">
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
              <p className="font-heading text-sm mb-1">Upload a file</p>
              <p className="text-xs text-ink-dim">.docx, .md, or .txt</p>
            </button>
          </div>

          {source === "gdoc" ? (
            <GdocSourcePanel
              googleEnabled={googleEnabled}
              picked={pickedDoc}
              onPick={setPickedDoc}
            />
          ) : (
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
              <ThemePreview themeId={t.id} characterName={characterName} />
              <p className="font-heading text-sm mt-3">{t.name}</p>
              <p className="text-xs text-ink-dim">{t.description}</p>
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
          onClick={() =>
            step === 0 ? router.push("/dashboard") : setStep(step - 1)
          }
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
