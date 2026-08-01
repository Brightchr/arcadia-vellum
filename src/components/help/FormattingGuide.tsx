"use client";

import { useEffect, useState } from "react";

const ROWS: { doc: string; tome: string }[] = [
  {
    doc: "Heading 1 (the paragraph-style dropdown, not just big text)",
    tome: "Chapter title — starts a fresh page, centered with ornaments and a rule, and the first paragraph after it gets an illuminated drop cap. Use one per session.",
  },
  {
    doc: "Heading 2 / Heading 3",
    tome: "Section headings inside a session, with a leading flourish glyph.",
  },
  {
    doc: "Bold and italic",
    tome: "Rendered in the theme's two accent inks — deliberate emphasis, not just weight.",
  },
  {
    doc: "Insert → Horizontal line",
    tome: "A fleuron scene divider (❦ ❦ ❦ — each theme uses its own glyph). Perfect for scene breaks.",
  },
  {
    doc: "Bulleted / numbered lists",
    tome: "Styled lists; numbering continues correctly across page turns.",
  },
  {
    doc: "Images",
    tome: "Framed illustrations, tinted to match the binding.",
  },
];

/** "How to write your Doc" legend, shown from the wizard and settings. */
export function FormattingGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="text-sm text-arcane-bright hover:underline"
        onClick={() => setOpen(true)}
      >
        📜 How your writing becomes a tome
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Formatting guide"
          onClick={() => setOpen(false)}
        >
          <div
            className="panel-arcane w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <h2 className="font-display text-xl text-arcane-bright">
                The Scribe&apos;s Legend
              </h2>
              <button
                type="button"
                className="btn-ghost text-xs px-2.5 py-1"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-ink-dim mb-5">
              Write in Google Docs (or .docx/Markdown) using ordinary document
              structure — the binding does the dressing-up.
            </p>

            <div className="space-y-3">
              {ROWS.map((row) => (
                <div
                  key={row.doc}
                  className="grid sm:grid-cols-[1fr_1.6fr] gap-1 sm:gap-4 border border-void-border rounded-lg p-3"
                >
                  <p className="text-sm font-heading text-ember">{row.doc}</p>
                  <p className="text-sm text-ink-dim">{row.tome}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2 text-sm text-ink-dim">
              <p>
                <span className="text-arcane-bright">Worth knowing:</span>{" "}
                fonts, colors, and sizes set in the Doc are intentionally
                ignored — every theme fully re-inks your words, so structure is
                all that matters.
              </p>
              <p>
                After writing new entries, open your tome (it refreshes itself)
                or hit <span className="text-arcane-bright">Resync</span> on
                the dashboard.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
