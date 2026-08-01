"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip-enhanced";
import { paginateHtml, preloadImages } from "./paginate";

interface Dims {
  pageW: number;
  pageH: number;
  portrait: boolean;
}

function computeDims(containerW: number, containerH: number): Dims {
  const margin = 56;
  const availH = Math.max(320, containerH - margin);
  const portrait = containerW < 760;
  let pageW = portrait
    ? Math.min(containerW - 24, 480)
    : Math.min((containerW - margin) / 2, 540);
  let pageH = Math.round(pageW / 0.68);
  if (pageH > availH) {
    pageH = availH;
    pageW = Math.round(pageH * 0.68);
  }
  return { pageW: Math.round(pageW), pageH, portrait };
}

export default function TomeReader({
  html,
  theme,
  title,
  characterName,
}: {
  html: string;
  theme: string;
  title: string;
  characterName?: string | null;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const measurerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<any>(null);
  const [dims, setDims] = useState<Dims | null>(null);
  const [pages, setPages] = useState<string[] | null>(null);
  const [pageNo, setPageNo] = useState(0);
  // Deep link: /j/<slug>?page=N opens the tome at that leaf.
  const [startPage] = useState(() => {
    if (typeof window === "undefined") return 0;
    const p = parseInt(
      new URLSearchParams(window.location.search).get("page") ?? "0",
      10
    );
    return Number.isFinite(p) && p > 0 ? p : 0;
  });

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
      await document.fonts.ready;
      await preloadImages(html);
      if (cancelled || !measurerRef.current) return;
      measurerRef.current.style.width = `${dims.pageW}px`;
      const result = paginateHtml(html, measurerRef.current, dims.pageH);
      if (!cancelled) {
        setPages(result.length > 0 ? result : [emptyPageHtml()]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dims, html]);

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
  // Keep total children even so the back cover sits on its own side.
  const needsFiller = contentPages.length % 2 === 1;
  const totalLeaves = contentPages.length + (needsFiller ? 1 : 0) + 2;
  const bookKey = dims
    ? `${dims.pageW}x${dims.pageH}-${theme}-${contentPages.length}`
    : "pending";

  // The flipbook clones every child, so the children list must contain only
  // real elements — no `false`/null from conditional rendering.
  const leaves: React.ReactElement[] = [
    <div key="cover" className="tome-cover">
      <div className="tome-cover-ornament">✦ ✧ ✦</div>
      <h1 className="tome-cover-title">{title}</h1>
      <hr className="tome-cover-rule" />
      {characterName ? (
        <p className="tome-cover-subtitle">The chronicle of {characterName}</p>
      ) : (
        <p className="tome-cover-subtitle">A chronicle</p>
      )}
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
    leaves.push(
      <div key="filler" className="tome-page tome-page--right">
        <div className="tome-page-number">{contentPages.length + 1}</div>
      </div>
    );
  }
  leaves.push(
    <div key="back" className="tome-cover">
      <div className="tome-cover-ornament">✦</div>
      <p className="tome-cover-subtitle">Here ends the chronicle</p>
      <p className="tome-cover-subtitle" style={{ opacity: 0.6 }}>
        — for now —
      </p>
    </div>
  );

  return (
    <div className={`theme-${theme} tome-reader-stage`} ref={stageRef}>
      {/* Hidden measurer — must carry real page styles for accurate breaks */}
      <div className="tome-page tome-measurer" ref={measurerRef} />

      {!pages && (
        <p className="text-ink-dim animate-pulse font-heading">
          Binding the pages...
        </p>
      )}

      {pages && dims && (
        <>
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
            flippingTime={800}
            mobileScrollSupport
            clickEventForward
            useMouseEvents
            swipeDistance={30}
            showPageCorners
            disableFlipByClick={false}
            startPage={Math.min(startPage, contentPages.length + 1)}
            startZIndex={0}
            autoSize={false}
            style={{}}
            className="tome-book"
            onFlip={(e: any) => setPageNo(e.data ?? 0)}
          >
            {leaves}
          </HTMLFlipBook>

          {/* Flip controls */}
          <button
            type="button"
            aria-label="Previous page"
            className="tome-nav tome-nav--prev"
            onClick={() => bookRef.current?.pageFlip?.()?.flipPrev()}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next page"
            className="tome-nav tome-nav--next"
            onClick={() => bookRef.current?.pageFlip?.()?.flipNext()}
          >
            ›
          </button>
          <div className="tome-progress">
            {Math.min(pageNo + 1, totalLeaves)} / {totalLeaves}
          </div>
        </>
      )}
    </div>
  );
}

function emptyPageHtml(): string {
  return "<h1>Blank Pages</h1><p>This tome awaits its first entry. Sync your document or upload a file with some writing in it.</p>";
}
