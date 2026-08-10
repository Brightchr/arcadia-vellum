"use client";

import { useRef, useState } from "react";
import {
  DEFAULT_AUTHOR_POS,
  DEFAULT_TITLE_POS,
  parseCoverLayout,
  type CoverLayout,
  type CoverPoint,
} from "@/lib/cover-layout";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Live preview of the cover art where the owner drags the title/author
 * blocks into place (or hides them entirely). Renders with the same
 * .cover-art styles the reader and player use, so what you place is what
 * readers get.
 */
export function CoverLayoutEditor({
  coverUrl,
  title,
  subtitle,
  author,
  layout: storedLayout,
  aspect,
  disabled = false,
  onSave,
}: {
  coverUrl: string;
  title: string;
  subtitle?: string | null;
  author?: string | null;
  /** The journal's stored layout JSON (raw column value). */
  layout: string | null;
  /** Preview shape: written tomes read at 7:10, player art is 3:4. */
  aspect: "book" | "audio";
  disabled?: boolean;
  onSave: (layout: CoverLayout) => Promise<boolean>;
}) {
  const [initial] = useState(() => parseCoverLayout(storedLayout));
  const [showText, setShowText] = useState(!initial.hideText);
  const [titlePos, setTitlePos] = useState<CoverPoint>(
    initial.title ?? DEFAULT_TITLE_POS
  );
  const [authorPos, setAuthorPos] = useState<CoverPoint>(
    initial.author ?? DEFAULT_AUTHOR_POS
  );
  const [dirty, setDirty] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  function startDrag(e: React.PointerEvent, which: "title" | "author") {
    if (disabled) return;
    e.preventDefault();
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const start = which === "title" ? titlePos : authorPos;
    const sx = e.clientX;
    const sy = e.clientY;
    const move = (ev: PointerEvent) => {
      const p = {
        x: round1(clamp(start.x + ((ev.clientX - sx) / rect.width) * 100, 4, 96)),
        y: round1(clamp(start.y + ((ev.clientY - sy) / rect.height) * 100, 4, 96)),
      };
      (which === "title" ? setTitlePos : setAuthorPos)(p);
      setDirty(true);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop);
  }

  async function save() {
    const ok = await onSave({
      ...(showText ? {} : { hideText: true }),
      title: titlePos,
      author: authorPos,
    });
    if (ok) setDirty(false);
  }

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        className={`cover-art !h-auto w-full max-w-64 rounded-lg border border-void-border select-none ${
          aspect === "book" ? "aspect-[7/10]" : "aspect-[3/4]"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="Cover art" className="cover-art-img" />
        {showText && (
          <>
            <div
              className="cover-art-block cursor-move touch-none rounded px-1.5 py-1 outline-dashed outline-1 outline-white/50 hover:outline-arcane-bright"
              style={{ left: `${titlePos.x}%`, top: `${titlePos.y}%` }}
              onPointerDown={(e) => startDrag(e, "title")}
              title="Drag to place the title"
            >
              <h1 className="cover-art-title">{title}</h1>
              {subtitle && <p className="cover-art-subtitle">{subtitle}</p>}
            </div>
            {author && (
              <div
                className="cover-art-block cursor-move touch-none rounded px-1.5 py-1 outline-dashed outline-1 outline-white/50 hover:outline-arcane-bright"
                style={{ left: `${authorPos.x}%`, top: `${authorPos.y}%` }}
                onPointerDown={(e) => startDrag(e, "author")}
                title="Drag to place the author"
              >
                <p className="cover-art-author">{author}</p>
              </div>
            )}
          </>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="accent-[var(--arcane)]"
          checked={showText}
          disabled={disabled}
          onChange={(e) => {
            setShowText(e.target.checked);
            setDirty(true);
          }}
        />
        Show the title &amp; author on the cover
      </label>
      {showText && (
        <p className="text-xs text-ink-dim">
          Drag the text blocks on the preview to place them. If the artwork
          already includes its own title, untick the box instead.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-arcane"
          disabled={disabled || !dirty}
          onClick={() => void save()}
        >
          Save Text Layout
        </button>
        {dirty && (
          <span className="text-xs text-ink-dim">Unsaved layout changes</span>
        )}
      </div>
    </div>
  );
}
