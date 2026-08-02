import sanitizeHtml from "sanitize-html";
import * as cheerio from "cheerio";

/**
 * Google Docs export carries emphasis as inline styles on <span>s
 * (font-weight:700, font-style:italic, ...) rather than semantic tags.
 * Translate those into <strong>/<em>/<u>/<s>/<sup>/<sub> before the
 * sanitizer strips spans and styles.
 */
export function normalizeInlineStyles(html: string): string {
  if (!/style\s*=/i.test(html)) return html;
  const $ = cheerio.load(html);
  $("span[style]").each((_, el) => {
    const node = $(el);
    const style = node.attr("style") ?? "";
    const bold = /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
    const italic = /font-style\s*:\s*italic/i.test(style);
    const underline = /text-decoration[^;]*underline/i.test(style);
    const strike = /text-decoration[^;]*line-through/i.test(style);
    const sup = /vertical-align\s*:\s*super/i.test(style);
    const sub = /vertical-align\s*:\s*sub/i.test(style);
    if (!(bold || italic || underline || strike || sup || sub)) return;

    let inner = node.html() ?? "";
    if (sub) inner = `<sub>${inner}</sub>`;
    if (sup) inner = `<sup>${inner}</sup>`;
    if (strike) inner = `<s>${inner}</s>`;
    if (underline) inner = `<u>${inner}</u>`;
    if (italic) inner = `<em>${inner}</em>`;
    if (bold) inner = `<strong>${inner}</strong>`;
    node.html(inner);
  });
  return $("body").html() ?? html;
}

/**
 * Sanitizes journal HTML from any source (Google Docs export, mammoth,
 * markdown) down to a small semantic vocabulary the themed renderer styles.
 * All classes/styles/ids are stripped — theming is entirely ours.
 */
export function sanitizeJournalHtml(html: string): string {
  return sanitizeHtml(normalizeInlineStyles(html), {
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
