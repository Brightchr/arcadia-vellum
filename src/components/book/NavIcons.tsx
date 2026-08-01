"use client";

/**
 * Hand-drawn-style navigation glyphs, one per theme. All stroke-based and
 * colored via currentColor so themes.css tints and glows them.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function arrowPaths(theme: string) {
  switch (theme) {
    case "witch-grimoire":
      // Crooked twig arrow with a spark at its tip
      return (
        <>
          <path {...STROKE} d="M3 12q4.5-2.6 9 0t8.5 0" />
          <path {...STROKE} d="M15.5 7.5 20.5 12l-5 4.5" />
          <path {...STROKE} d="M5.5 9.5 3.2 12l2.3 2.5" />
          <circle cx="17.4" cy="5.6" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "elven-chronicle":
      // Arrow loosed through a bow
      return (
        <>
          <path {...STROKE} d="M8 4.5a8.6 8.6 0 0 1 0 15" />
          <path {...STROKE} d="M8 4.5v15" strokeDasharray="1.5 2.5" />
          <path {...STROKE} d="M3.5 12H21" />
          <path {...STROKE} d="M17 8.5 21 12l-4 3.5" />
          <path {...STROKE} d="m5.5 9.8-2 2.2 2 2.2" />
        </>
      );
    case "captains-log":
      // Compass needle
      return (
        <>
          <path {...STROKE} d="M3 12l10.5-2.6L21 12l-7.5 2.6Z" />
          <circle cx="13.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <path {...STROKE} d="M6.5 8.5v-1M6.5 16.5v1" />
        </>
      );
    case "arcane-codex":
      // Comet streaking with speed-lines
      return (
        <>
          <path
            fill="currentColor"
            stroke="none"
            d="M17.6 7.6l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1Z"
          />
          <path {...STROKE} d="M3 9.6h8.5M4.5 14.4h8M3.5 12h7" />
        </>
      );
    default:
      // Ancient tome & fallback: arrow with scroll-curled fletching
      return (
        <>
          <path {...STROKE} d="M4.5 12H20" />
          <path {...STROKE} d="M15.5 7.5 20.5 12l-5 4.5" />
          <path {...STROKE} d="M4.5 12c-1.6-.8-1.9-2.4-.4-3.4M4.5 12c-1.6.8-1.9 2.4-.4 3.4" />
        </>
      );
  }
}

export function ThemedArrow({
  theme,
  direction,
}: {
  theme: string;
  direction: "prev" | "next";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      aria-hidden="true"
      style={direction === "prev" ? { transform: "scaleX(-1)" } : undefined}
    >
      {arrowPaths(theme)}
    </svg>
  );
}

/** Skip-to-cover glyph: bar plus double chevron. */
export function JumpIcon({ direction }: { direction: "first" | "last" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      aria-hidden="true"
      style={direction === "first" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path {...STROKE} d="M20 6v12" />
      <path {...STROKE} d="m5 7 5 5-5 5" />
      <path {...STROKE} d="m11 7 5 5-5 5" />
    </svg>
  );
}
