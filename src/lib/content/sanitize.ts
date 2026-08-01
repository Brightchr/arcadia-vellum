import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes journal HTML from any source (Google Docs export, mammoth,
 * markdown) down to a small semantic vocabulary the themed renderer styles.
 * All classes/styles/ids are stripped — theming is entirely ours.
 */
export function sanitizeJournalHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "em",
      "i",
      "strong",
      "b",
      "u",
      "s",
      "sub",
      "sup",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "figure",
      "figcaption",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    // Journal images are rewritten to local /api/images/<id> URLs before
    // sanitization; allow those relative srcs through.
    allowProtocolRelative: false,
    allowedSchemesByTag: {
      img: ["https"],
    },
    exclusiveFilter(frame) {
      // Drop empty paragraphs Google Docs loves to emit (but keep <p><br></p>
      // as intentional blank lines, and keep media/rule tags).
      if (frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren) {
        return true;
      }
      return false;
    },
    transformTags: {
      // Google export nests everything in spans with inline styles; spans are
      // simply dropped (not in allowedTags) and their text kept.
      a(tagName, attribs) {
        return {
          tagName: "a",
          attribs: { ...attribs, rel: "noopener", target: "_blank" },
        };
      },
    },
    nonTextTags: ["style", "script", "textarea", "option", "head", "title"],
  });
}

export function plainTextLength(html: string): number {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim()
    .length;
}
