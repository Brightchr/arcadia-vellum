import {
  DEFAULT_AUTHOR_POS,
  DEFAULT_TITLE_POS,
  type CoverLayout,
  type CoverPoint,
} from "@/lib/cover-layout";
import { fontCss, textureById } from "@/lib/theme-assets";

/** Text drawn over uploaded cover art, book-jacket style. */
export interface CoverText {
  title: string;
  subtitle?: string | null;
  author?: string | null;
  layout?: CoverLayout | null;
}

function blockStyle(
  p: CoverPoint,
  layout: CoverLayout | null | undefined
): React.CSSProperties {
  const style: React.CSSProperties = { left: `${p.x}%`, top: `${p.y}%` };
  const font = fontCss(layout?.font);
  if (font) style.fontFamily = font;
  if (layout?.color) style.color = layout.color;
  return style;
}

/** The backdrop layer for transparent-background art. */
export function coverBgStyle(
  layout: CoverLayout | null | undefined
): React.CSSProperties | null {
  const bg = layout?.bg;
  if (!bg) return null;
  const style: React.CSSProperties = {};
  if (bg.color) style.backgroundColor = bg.color;
  const texture = textureById(bg.texture);
  if (texture?.layers) {
    style.backgroundImage = texture.layers;
    if (texture.sizes) style.backgroundSize = texture.sizes;
    if (texture.positions) style.backgroundPosition = texture.positions;
  }
  return Object.keys(style).length > 0 ? style : null;
}

/**
 * Uploaded cover art with the work's title/author overlaid where the owner
 * placed them (or nowhere, if they hid the text), in the cover's own font
 * and color when overridden. Fills its parent — size it from outside. Pass
 * no `text` to show the bare image (e.g. chapter art).
 */
export function CoverArt({
  url,
  text,
  className = "",
}: {
  url: string;
  text?: CoverText | null;
  className?: string;
}) {
  const layout = text?.layout ?? {};
  const bgStyle = coverBgStyle(layout);
  return (
    <div className={`cover-art ${className}`}>
      {bgStyle && <div className="cover-art-bg" style={bgStyle} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="cover-art-img" />
      {text && !layout.hideText && (
        <>
          <div
            className="cover-art-block"
            style={blockStyle(layout.title ?? DEFAULT_TITLE_POS, layout)}
          >
            <h1 className="cover-art-title">{text.title}</h1>
            {text.subtitle && (
              <p className="cover-art-subtitle">{text.subtitle}</p>
            )}
          </div>
          {text.author && (
            <div
              className="cover-art-block"
              style={blockStyle(layout.author ?? DEFAULT_AUTHOR_POS, layout)}
            >
              <p className="cover-art-author">{text.author}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
