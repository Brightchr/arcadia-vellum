import {
  DEFAULT_AUTHOR_POS,
  DEFAULT_TITLE_POS,
  type CoverLayout,
  type CoverPoint,
} from "@/lib/cover-layout";

/** Text drawn over uploaded cover art, book-jacket style. */
export interface CoverText {
  title: string;
  subtitle?: string | null;
  author?: string | null;
  layout?: CoverLayout | null;
}

function blockStyle(p: CoverPoint): React.CSSProperties {
  return { left: `${p.x}%`, top: `${p.y}%` };
}

/**
 * Uploaded cover art with the work's title/author overlaid where the owner
 * placed them (or nowhere, if they hid the text). Fills its parent — size it
 * from outside. Pass no `text` to show the bare image (e.g. chapter art).
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
  return (
    <div className={`cover-art ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="cover-art-img" />
      {text && !layout.hideText && (
        <>
          <div
            className="cover-art-block"
            style={blockStyle(layout.title ?? DEFAULT_TITLE_POS)}
          >
            <h1 className="cover-art-title">{text.title}</h1>
            {text.subtitle && (
              <p className="cover-art-subtitle">{text.subtitle}</p>
            )}
          </div>
          {text.author && (
            <div
              className="cover-art-block"
              style={blockStyle(layout.author ?? DEFAULT_AUTHOR_POS)}
            >
              <p className="cover-art-author">{text.author}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
