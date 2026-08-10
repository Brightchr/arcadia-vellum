"use client";

import { useRef, useState } from "react";
import {
  DEFAULT_AUTHOR_POS,
  DEFAULT_TITLE_POS,
  parseCoverLayout,
  type CoverLayout,
  type CoverPoint,
} from "@/lib/cover-layout";
import { THEME_FONTS, THEME_TEXTURES, fontCss, textureById } from "@/lib/theme-assets";

const DEFAULT_TEXT_COLOR = "#f4efe6";

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Live preview of the cover art where the owner drags the title/author into
 * place and styles them — font, color, and a backdrop (color + texture) for
 * transparent-background art. These override the theme for the cover only.
 * Renders with the same .cover-art styles the reader and player use.
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
  const [font, setFont] = useState(initial.font ?? "");
  const [color, setColor] = useState(initial.color ?? DEFAULT_TEXT_COLOR);
  const [bgOn, setBgOn] = useState(!!initial.bg);
  const [bgColor, setBgColor] = useState(initial.bg?.color ?? "#1a1420");
  const [bgTexture, setBgTexture] = useState(initial.bg?.texture ?? "none");
  const [dirty, setDirty] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  function touch<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setDirty(true);
    };
  }

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
    const layout: CoverLayout = {
      ...(showText ? {} : { hideText: true }),
      title: titlePos,
      author: authorPos,
    };
    if (font) layout.font = font;
    if (color.toLowerCase() !== DEFAULT_TEXT_COLOR) layout.color = color;
    if (bgOn) {
      layout.bg = { color: bgColor };
      if (bgTexture !== "none") layout.bg.texture = bgTexture;
    }
    const ok = await onSave(layout);
    if (ok) setDirty(false);
  }

  const texture = textureById(bgTexture);
  const textStyle: React.CSSProperties = { color };
  const fontFamily = fontCss(font);
  if (fontFamily) textStyle.fontFamily = fontFamily;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,16rem)_1fr]">
      <div
        ref={boxRef}
        className={`cover-art !h-auto w-full max-w-64 rounded-lg border border-void-border select-none ${
          aspect === "book" ? "aspect-[7/10]" : "aspect-[3/4]"
        }`}
      >
        {bgOn && (
          <div
            className="cover-art-bg"
            style={{
              backgroundColor: bgColor,
              ...(texture?.layers
                ? {
                    backgroundImage: texture.layers,
                    backgroundSize: texture.sizes,
                    backgroundPosition: texture.positions,
                  }
                : {}),
            }}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl} alt="Cover art" className="cover-art-img" />
        {showText && (
          <>
            <div
              className="cover-art-block cursor-move touch-none rounded px-1.5 py-1 outline-dashed outline-1 outline-white/50 hover:outline-arcane-bright"
              style={{ left: `${titlePos.x}%`, top: `${titlePos.y}%`, ...textStyle }}
              onPointerDown={(e) => startDrag(e, "title")}
              title="Drag to place the title"
            >
              <h1 className="cover-art-title">{title}</h1>
              {subtitle && <p className="cover-art-subtitle">{subtitle}</p>}
            </div>
            {author && (
              <div
                className="cover-art-block cursor-move touch-none rounded px-1.5 py-1 outline-dashed outline-1 outline-white/50 hover:outline-arcane-bright"
                style={{ left: `${authorPos.x}%`, top: `${authorPos.y}%`, ...textStyle }}
                onPointerDown={(e) => startDrag(e, "author")}
                title="Drag to place the author"
              >
                <p className="cover-art-author">{author}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="space-y-4 min-w-0">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="accent-[var(--arcane)]"
            checked={showText}
            disabled={disabled}
            onChange={(e) => touch(setShowText)(e.target.checked)}
          />
          Show the title &amp; author on the cover
        </label>

        {showText && (
          <>
            <p className="text-xs text-ink-dim">
              Drag the text blocks on the preview to place them. Font and
              color here style the cover only — the theme handles the rest of
              the book.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="cover-font"
                  className="block text-xs mb-1 text-ink-dim"
                >
                  Cover font
                </label>
                <select
                  id="cover-font"
                  className="input-arcane !w-auto !py-1.5 text-sm"
                  value={font}
                  disabled={disabled}
                  onChange={(e) => touch(setFont)(e.target.value)}
                >
                  <option value="">Theme font</option>
                  {THEME_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="cover-color"
                  className="block text-xs mb-1 text-ink-dim"
                >
                  Text color
                </label>
                <input
                  id="cover-color"
                  type="color"
                  className="h-9 w-14 rounded border border-void-border bg-transparent cursor-pointer"
                  value={color}
                  disabled={disabled}
                  onChange={(e) => touch(setColor)(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="space-y-2 border-t border-void-border pt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="accent-[var(--arcane)]"
              checked={bgOn}
              disabled={disabled}
              onChange={(e) => touch(setBgOn)(e.target.checked)}
            />
            Backdrop behind the art
            <span className="text-xs text-ink-dim">
              (shows through transparent images)
            </span>
          </label>
          {bgOn && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="cover-bg-color"
                  className="block text-xs mb-1 text-ink-dim"
                >
                  Backdrop color
                </label>
                <input
                  id="cover-bg-color"
                  type="color"
                  className="h-9 w-14 rounded border border-void-border bg-transparent cursor-pointer"
                  value={bgColor}
                  disabled={disabled}
                  onChange={(e) => touch(setBgColor)(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="cover-bg-texture"
                  className="block text-xs mb-1 text-ink-dim"
                >
                  Texture
                </label>
                <select
                  id="cover-bg-texture"
                  className="input-arcane !w-auto !py-1.5 text-sm"
                  value={bgTexture}
                  disabled={disabled}
                  onChange={(e) => touch(setBgTexture)(e.target.value)}
                >
                  {THEME_TEXTURES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-arcane"
            disabled={disabled || !dirty}
            onClick={() => void save()}
          >
            Save Cover Style
          </button>
          {dirty && (
            <span className="text-xs text-ink-dim">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
}
