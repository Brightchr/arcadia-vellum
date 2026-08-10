import { isFontId, isHexColor, isTextureId } from "@/lib/theme-assets";

/**
 * Layout of the text overlaid on uploaded cover art. Coordinates are the
 * CENTER of each text block, as percentages of the cover's width/height, so
 * one layout scales from a browse thumbnail to the full reader cover.
 */
export interface CoverPoint {
  x: number;
  y: number;
}

/**
 * Backdrop drawn behind the art — matters for images with a transparent
 * background (banners, seals, die-cut art), invisible under opaque ones.
 */
export interface CoverBackground {
  /** Base color under the art. */
  color?: string;
  /** Texture overlay id (see THEME_TEXTURES). */
  texture?: string;
}

export interface CoverLayout {
  /** True = the art speaks for itself; no title/author text is drawn. */
  hideText?: boolean;
  /** Center of the title (+ subtitle) block. */
  title?: CoverPoint;
  /** Center of the author line. */
  author?: CoverPoint;
  /** Cover-only font override (THEME_FONTS id); the theme picks otherwise. */
  font?: string;
  /** Cover-only text color override. */
  color?: string;
  bg?: CoverBackground;
}

export const DEFAULT_TITLE_POS: CoverPoint = { x: 50, y: 24 };
export const DEFAULT_AUTHOR_POS: CoverPoint = { x: 50, y: 88 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parsePoint(value: unknown): CoverPoint | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== "number" || typeof y !== "number") return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return {
    x: Math.round(clamp(x, 0, 100) * 10) / 10,
    y: Math.round(clamp(y, 0, 100) * 10) / 10,
  };
}

/**
 * Parses a stored (or client-sent) layout, dropping anything malformed.
 * Accepts the JSON string from the DB or an already-parsed object.
 */
export function parseCoverLayout(raw: unknown): CoverLayout {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof value !== "object" || value === null) return {};
  const layout = value as Record<string, unknown>;
  const parsed: CoverLayout = {};
  if (layout.hideText === true) parsed.hideText = true;
  const title = parsePoint(layout.title);
  if (title) parsed.title = title;
  const author = parsePoint(layout.author);
  if (author) parsed.author = author;
  if (isFontId(layout.font)) parsed.font = layout.font;
  if (isHexColor(layout.color)) parsed.color = layout.color;
  if (typeof layout.bg === "object" && layout.bg !== null) {
    const bg = layout.bg as Record<string, unknown>;
    const parsedBg: CoverBackground = {};
    if (isHexColor(bg.color)) parsedBg.color = bg.color;
    if (isTextureId(bg.texture) && bg.texture !== "none") {
      parsedBg.texture = bg.texture;
    }
    if (Object.keys(parsedBg).length > 0) parsed.bg = parsedBg;
  }
  return parsed;
}
