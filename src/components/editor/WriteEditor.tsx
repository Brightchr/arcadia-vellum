"use client";

import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { FormattingGuide } from "@/components/help/FormattingGuide";

/**
 * Markdown editor for written-here tomes. The server re-renders and
 * sanitizes on save; the preview here is a quick local approximation.
 */
export function WriteEditor({
  journalId,
  initialMarkdown,
}: {
  journalId: string;
  initialMarkdown: string;
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [savedMarkdown, setSavedMarkdown] = useState(initialMarkdown);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dirty = markdown !== savedMarkdown;

  const previewHtml = useMemo(
    () => (tab === "preview" ? marked.parse(markdown, { async: false }) : ""),
    [tab, markdown]
  );

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/journals/${journalId}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Save failed.");
      else {
        setSavedMarkdown(markdown);
        setNotice("Saved.");
      }
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  // Ctrl/Cmd+S saves; warn before leaving with unsaved changes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, savedMarkdown, busy]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const tabClass = (t: "write" | "preview") =>
    `px-3 py-1.5 text-sm font-heading rounded-md transition ${
      tab === t
        ? "bg-arcane/15 text-arcane-bright"
        : "text-ink-dim hover:text-ink"
    }`;

  return (
    <div className="panel-arcane p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" className={tabClass("write")} onClick={() => setTab("write")}>
            Write
          </button>
          <button type="button" className={tabClass("preview")} onClick={() => setTab("preview")}>
            Preview
          </button>
        </div>
        <div className="flex items-center gap-3">
          <FormattingGuide />
          <span className="text-xs text-ink-dim" role="status">
            {error ? (
              <span className="text-red-400">{error}</span>
            ) : dirty ? (
              "Unsaved changes"
            ) : (
              (notice ?? "")
            )}
          </span>
          <button
            type="button"
            className="btn-arcane"
            disabled={busy || !dirty}
            onClick={save}
          >
            {busy ? "Binding..." : "Save"}
          </button>
        </div>
      </div>

      {tab === "write" ? (
        <textarea
          value={markdown}
          aria-label="Journal content (Markdown)"
          placeholder={
            "# Session One\n\nThe rain had not stopped for three days when we reached Hollowmere...\n\nWrite in Markdown — see the formatting guide above."
          }
          spellCheck
          className="input-arcane font-mono text-sm leading-relaxed min-h-[60vh] resize-y"
          onChange={(e) => setMarkdown(e.target.value)}
        />
      ) : (
        <div className="min-h-[60vh] border border-void-border rounded-md p-5">
          {markdown.trim() ? (
            <div
              className="editor-preview"
              // Local preview of the user's own markdown; readers get the
              // server-sanitized version.
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <p className="text-ink-dim text-sm italic">
              Nothing to preview yet — the pages are blank.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
