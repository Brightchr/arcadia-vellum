"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip-enhanced";
import { paginateHtml, preloadImages } from "./paginate";
import { ThemedArrow, JumpIcon } from "./NavIcons";
import { CoverArt } from "./CoverArt";
import type { CoverLayout } from "@/lib/cover-layout";

interface Dims {
  pageW: number;
  pageH: number;
  portrait: boolean;
}

function computeDims(containerW: number, containerH: number): Dims {
  const portrait = containerW < 700;
  const availH = Math.max(320, containerH - 28);
  let pageW = portrait
    ? Math.min(containerW - 16, 520)
    : Math.min((containerW - 96) / 2, 640);
  let pageH = Math.round(pageW / 0.7);
  if (pageH > availH) {
    pageH = availH;
    pageW = Math.round(pageH * 0.7);
  }
  return { pageW: Math.round(pageW), pageH, portrait };
}

export default function TomeReader({
  html,
  theme,
  title,
  subtitle,
  author,
  coverUrl,
  coverLayout,
}: {
  html: string;
  theme: string;
  title: string;
  subtitle?: string | null;
  author?: string | null;
  /** Uploaded cover art — replaces the themed front cover when set. */
  coverUrl?: string | null;
  coverLayout?: CoverLayout;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const measurerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const [dims, setDims] = useState<Dims | null>(null);
  const [pages, setPages] = useState<string[] | null>(null);
  // Bumped every time pagination produces a fresh page set — keyed into the
  // flipbook so it fully remounts. Without this, a repagination that lands on
  // the SAME page count (e.g. after a late font load) is silently ignored by
  // the flip library and the stale layout stays on screen.
  const [paginationId, setPaginationId] = useState(0);
  // Bumped when a web font finishes loading late so pagination re-runs with
  // the real glyph metrics.
  const [fontsVersion, setFontsVersion] = useState(0);
  // Deep link: /j/<slug>?page=N opens the tome at that leaf.
  const [startPage] = useState(() => {
    if (typeof window === "undefined") return 0;
    const p = parseInt(
      new URLSearchParams(window.location.search).get("page") ?? "0",
      10
    );
    return Number.isFinite(p) && p > 0 ? p : 0;
  });
  const [pageNo, setPageNo] = useState(startPage);
  // Non-null while the reader is typing a page number to jump to.
  const [pageInput, setPageInput] = useState<string | null>(null);

  // Track stage size; debounce updates and ignore no-op changes.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const next = computeDims(rect.width, rect.height);
      setDims((prev) =>
        prev &&
        prev.pageW === next.pageW &&
        prev.pageH === next.pageH &&
        prev.portrait === next.portrait
          ? prev
          : next
      );
    };
    update();
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(update, 250);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Paginate whenever size or content changes (after fonts and images load).
  useEffect(() => {
    if (!dims) return;
    let cancelled = false;
    (async () => {
      const measurer = measurerRef.current;
      if (!measurer) return;
      measurer.style.width = `${dims.pageW}px`;
      // Warm up the theme's fonts with real usage BEFORE measuring: web fonts
      // only start loading on first use, and document.fonts.ready resolves
      // early if nothing has requested them yet. Measuring with fallback
      // fonts (taller metrics) under-fills every page.
      measurer.innerHTML =
        "<h1>Ag</h1><h2>Ag</h2><p>Ag <strong>Ag</strong> <em>Ag</em></p>";
      await new Promise((r) => requestAnimationFrame(r));
      await document.fonts.ready;
      await preloadImages(html);
      if (cancelled || !measurerRef.current) return;
      const result = paginateHtml(html, measurerRef.current, dims.pageH);
      if (!cancelled) {
        setPages(result.length > 0 ? result : [emptyPageHtml()]);
        setPaginationId((v) => v + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, html, fontsVersion]);

  useEffect(() => {
    const onLoaded = () => setFontsVersion((v) => v + 1);
    document.fonts.addEventListener("loadingdone", onLoaded);
    return () => document.fonts.removeEventListener("loadingdone", onLoaded);
  }, []);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const flip = bookRef.current?.pageFlip?.();
      if (!flip) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") flip.flipNext();
      if (e.key === "ArrowLeft" || e.key === "PageUp") flip.flipPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const contentPages = pages ?? [];
  // Keep total children even so the back cover sits on its own side
  // (2 covers + 2 endpapers + content + optional filler).
  const needsFiller = contentPages.length % 2 === 1;
  const totalLeaves = contentPages.length + (needsFiller ? 1 : 0) + 4;

  const goTo = (leaf: number) => {
    const flip = bookRef.current?.pageFlip?.();
    if (!flip) return;
    const target = Math.max(0, Math.min(totalLeaves - 1, leaf));
    // Animate short hops; snap long jumps so pages don't flicker past.
    if (Math.abs(target - pageNo) <= 2) flip.flip(target);
    else flip.turnToPage(target);
    setPageNo(target);
  };
  const bookKey = dims
    ? `${dims.pageW}x${dims.pageH}-${theme}-${paginationId}`
    : "pending";

  // The flipbook clones every child, so the children list must contain only
  // real elements — no `false`/null from conditional rendering. It also
  // re-initializes (and resets to the start page) whenever the children prop
  // changes identity, so the list must be memoized: page-number state updates
  // from onFlip must NOT produce a new array.
  const leaves: React.ReactElement[] = useMemo(() => {
    const items: React.ReactElement[] = [
      // data-density="hard" makes covers flip as stiff boards, not paper.
      coverUrl ? (
        <div key="cover" className="tome-cover tome-cover--art" data-density="hard">
          <CoverArt
            url={coverUrl}
            text={{ title, subtitle, author, layout: coverLayout }}
          />
        </div>
      ) : (
        <div key="cover" className="tome-cover" data-density="hard">
          <div className="tome-cover-ornament tome-cover-ornament--front" />
          <h1 className="tome-cover-title">{title}</h1>
          {subtitle ? (
            <>
              <hr className="tome-cover-rule" />
              <p className="tome-cover-subtitle">{subtitle}</p>
            </>
          ) : (
            <hr className="tome-cover-rule" />
          )}
          {author && <p className="tome-cover-author">{author}</p>}
          <div className="tome-cover-runes">ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ</div>
        </div>
      ),
      // Endpaper glued inside the front cover, like a real binding.
      <div key="endpaper-front" className="tome-endpaper" data-density="hard">
        <span>✦</span>
      </div>,
      ...contentPages.map((page, i) => (
        <div
          key={`p${i}`}
          className={`tome-page ${
            i % 2 === 0 ? "tome-page--left" : "tome-page--right"
          }`}
        >
          <div dangerouslySetInnerHTML={{ __html: page }} />
          <div className="tome-page-number">{i + 1}</div>
        </div>
      )),
    ];
    if (needsFiller) {
      items.push(
        <div key="filler" className="tome-page tome-page--right">
          <div className="tome-page-number">{contentPages.length + 1}</div>
        </div>
      );
    }
    items.push(
      <div key="endpaper-back" className="tome-endpaper" data-density="hard">
        <span>✦</span>
      </div>
    );
    items.push(
      <div key="back" className="tome-cover" data-density="hard">
        <div className="tome-cover-ornament tome-cover-ornament--back" />
        <p className="tome-cover-subtitle">Here ends the chronicle</p>
        <p className="tome-cover-subtitle" style={{ opacity: 0.6 }}>
          — for now —
        </p>
        <div className="tome-cover-runes">ᚺ ᚾ ᛁ ᛃ ᛈ ᛇ</div>
      </div>
    );
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentPages, needsFiller, title, subtitle, author, coverUrl, coverLayout]);

  // Text and padding scale with page size so bigger screens get bigger type.
  const pageScale = dims
    ? Math.min(1.3, Math.max(0.85, dims.pageW / 500))
    : 1;
  const bookOpen = pageNo > 0 && pageNo < totalLeaves - 1;

  return (
    <div
      className={`theme-${theme} tome-reader-stage`}
      ref={stageRef}
      style={{ "--tome-page-scale": pageScale } as React.CSSProperties}
    >
      {/* Hidden measurer — must carry real page styles for accurate breaks */}
      <div className="tome-page tome-measurer" ref={measurerRef} />

      {!pages && (
        <p className="text-ink-dim animate-pulse font-heading">
          Binding the pages...
        </p>
      )}

      {pages && dims && (
        <>
          <div
            className={`tome-shell ${bookOpen ? "tome-shell--open" : ""}`}
            style={{ width: dims.portrait ? dims.pageW : dims.pageW * 2 }}
          >
            <div className="tome-edge tome-edge--left" />
            <div className="tome-edge tome-edge--right" />
            <div className="tome-edge tome-edge--bottom" />
            <HTMLFlipBook
            key={bookKey}
            ref={bookRef}
            width={dims.pageW}
            height={dims.pageH}
            size="fixed"
            minWidth={200}
            maxWidth={1000}
            minHeight={300}
            maxHeight={1600}
            usePortrait={dims.portrait}
            singlePage={dims.portrait}
            showCover
            drawShadow
            maxShadowOpacity={0.4}
            flippingTime={650}
            mobileScrollSupport
            clickEventForward
            useMouseEvents
            swipeDistance={30}
            showPageCorners
            disableFlipByClick={false}
            startPage={Math.min(pageNo, totalLeaves - 1)}
            startZIndex={0}
            autoSize={false}
            style={{}}
            className="tome-book"
            onFlip={(e: any) => setPageNo(e.data ?? 0)}
          >
            {leaves}
            </HTMLFlipBook>
            <div className="tome-magic" aria-hidden="true">
              <div className="tome-magic-glow" />
              <div className="tome-magic-smoke" />
              <div className="tome-magic-smoke tome-magic-smoke--2" />
              <div className="tome-magic-smoke tome-magic-smoke--3" />
              <span className="tome-magic-spark" />
              <span className="tome-magic-spark" />
              <span className="tome-magic-spark" />
              <span className="tome-magic-spark" />
              <span className="tome-magic-spark" />
              <span className="tome-magic-spark" />
            </div>
          </div>

          {/* Flip controls */}
          <button
            type="button"
            aria-label="Previous page"
            className="tome-nav tome-nav--prev"
            onClick={() => bookRef.current?.pageFlip?.()?.flipPrev()}
          >
            <ThemedArrow theme={theme} direction="prev" />
          </button>
          <button
            type="button"
            aria-label="Next page"
            className="tome-nav tome-nav--next"
            onClick={() => bookRef.current?.pageFlip?.()?.flipNext()}
          >
            <ThemedArrow theme={theme} direction="next" />
          </button>

          <div className="tome-navbar">
            <button
              type="button"
              aria-label="First page"
              className="tome-navbar-jump"
              onClick={() => goTo(0)}
            >
              <JumpIcon direction="first" />
            </button>

            {pageInput === null ? (
              <button
                type="button"
                className="tome-navbar-page"
                aria-label="Jump to a page number"
                onClick={() =>
                  setPageInput(String(Math.min(pageNo + 1, totalLeaves)))
                }
              >
                {Math.min(pageNo + 1, totalLeaves)} / {totalLeaves}
              </button>
            ) : (
              <form
                className="tome-navbar-page"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = parseInt(pageInput, 10);
                  if (Number.isFinite(n)) goTo(n - 1);
                  setPageInput(null);
                }}
              >
                <input
                  autoFocus
                  className="tome-navbar-input"
                  inputMode="numeric"
                  value={pageInput}
                  onChange={(e) =>
                    setPageInput(e.target.value.replace(/\D/g, ""))
                  }
                  onBlur={() => setPageInput(null)}
                  onFocus={(e) => e.target.select()}
                  aria-label="Page number"
                />
                <span> / {totalLeaves}</span>
              </form>
            )}

            <button
              type="button"
              aria-label="Last page"
              className="tome-navbar-jump"
              onClick={() => goTo(totalLeaves - 1)}
            >
              <JumpIcon direction="last" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function emptyPageHtml(): string {
  return "<h1>Blank Pages</h1><p>This tome awaits its first entry. Sync your document or upload a file with some writing in it.</p>";
}
