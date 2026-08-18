"use client";

/**
 * Measurement-based pagination: splits journal HTML into page-sized chunks by
 * appending blocks into a hidden measurer element (styled exactly like a real
 * page) and checking rendered height. Oversized blocks are split recursively,
 * preserving inline markup; text nodes are split by binary search on words.
 */

const SPLITTABLE = new Set(["P", "BLOCKQUOTE", "UL", "OL", "DIV", "LI"]);
const BREAK_BEFORE = new Set(["H1", "H2"]);

// Yield to the event loop this often so a long tome doesn't freeze the tab —
// each iteration forces a synchronous reflow, and big books have thousands.
const BLOCKS_PER_SLICE = 40;

/**
 * Every image gets a fixed display box BEFORE measurement, so pagination
 * never has to wait for downloads: the measured height is the same whether
 * the bytes have arrived or not. Images lazy-load into their boxes after the
 * tome is already bound.
 */
function fixImageBoxes(root: DocumentFragment, pageHeight: number) {
  const boxH = Math.round(pageHeight * 0.55);
  root.querySelectorAll("img").forEach((img) => {
    img.style.height = `${boxH}px`;
    img.style.width = "100%";
    img.style.objectFit = "contain";
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
  });
}

export async function paginateHtml(
  html: string,
  measurer: HTMLElement,
  pageHeight: number,
  isCancelled: () => boolean = () => false
): Promise<string[]> {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  fixImageBoxes(tpl.content, pageHeight);

  // Top-level work queue; stray text nodes get wrapped in paragraphs.
  const queue: Element[] = [];
  tpl.content.childNodes.forEach((n) => {
    if (n.nodeType === Node.ELEMENT_NODE) {
      queue.push(n as Element);
    } else if (n.textContent?.trim()) {
      const p = document.createElement("p");
      p.textContent = n.textContent;
      queue.push(p);
    }
  });

  const pages: string[] = [];
  measurer.innerHTML = "";
  const fits = () => measurer.offsetHeight <= pageHeight + 1;

  const flush = () => {
    if (measurer.childNodes.length > 0) {
      pages.push(measurer.innerHTML);
      measurer.innerHTML = "";
    }
  };

  let guard = 0;
  let sinceYield = 0;
  let i = 0;
  while (i < queue.length) {
    if (++guard > 20000) break; // safety against pathological loops
    if (++sinceYield >= BLOCKS_PER_SLICE) {
      sinceYield = 0;
      await new Promise((r) => setTimeout(r, 0));
      // A newer pagination (resize, font load) owns the measurer now.
      if (isCancelled()) return [];
    }
    const block = queue[i];

    if (BREAK_BEFORE.has(block.tagName) && measurer.childNodes.length > 0) {
      flush();
    }

    measurer.appendChild(block);
    if (fits()) {
      i++;
      continue;
    }

    measurer.removeChild(block);
    if (measurer.childNodes.length > 0) {
      // The page has content and this block overflows what's left. Fill the
      // remaining space by splitting the block (like a real book) instead of
      // pushing it whole and leaving a half-empty page.
      if (SPLITTABLE.has(block.tagName)) {
        const shell = block.cloneNode(false) as Element;
        measurer.appendChild(shell);
        if (fits()) {
          const remainder = fillFrom(block, shell, fits);
          const tookText = (shell.textContent ?? "").trim().length > 0;
          const tookElements = shell.children.length > 0;
          if (tookText || tookElements) {
            // Word-level carry-over: keep what fits, continue on the next page.
            flush();
            if (remainder) {
              queue[i] = remainder;
            } else {
              i++;
            }
            continue;
          }
          // Not even one word fit in the remaining space — reassemble and
          // move the block whole.
          const restored = block.cloneNode(false) as Element;
          while (shell.firstChild) restored.appendChild(shell.firstChild);
          if (remainder) {
            while (remainder.firstChild) restored.appendChild(remainder.firstChild);
          }
          queue[i] = restored;
          measurer.removeChild(shell);
          flush();
          continue;
        }
        measurer.removeChild(shell);
      }
      // Unsplittable (heading, image, table) — retry on a fresh page.
      flush();
      continue;
    }

    // Block alone overflows an empty page.
    if (SPLITTABLE.has(block.tagName)) {
      const shell = block.cloneNode(false) as Element;
      measurer.appendChild(shell);
      const remainder = fillFrom(block, shell, fits);
      if (shell.childNodes.length === 0) {
        // Not even a single word fit (extreme page size) — force and clip.
        measurer.removeChild(shell);
        measurer.appendChild(block);
        flush();
        i++;
      } else {
        flush();
        if (remainder) {
          queue[i] = remainder;
        } else {
          i++;
        }
      }
    } else {
      // Unsplittable (image, table, heading...) — give it its own page.
      measurer.appendChild(block);
      flush();
      i++;
    }
  }
  flush();

  return pages;
}

/**
 * Moves as much of `source`'s content into `target` (an empty shallow clone
 * already attached to the page) as fits. Returns a remainder element with the
 * leftover content, or null if everything fit.
 */
function fillFrom(
  source: Element,
  target: Element,
  fits: () => boolean
): Element | null {
  const kids = Array.from(source.childNodes);

  for (let i = 0; i < kids.length; i++) {
    const kid = kids[i];
    target.appendChild(kid);
    if (fits()) continue;

    // `kid` overflowed the page — split it if possible, then bundle the rest.
    const rest = kids.slice(i + 1);
    let remainderKids: Node[];

    if (kid.nodeType === Node.TEXT_NODE) {
      const full = kid.textContent ?? "";
      const tokens = full.match(/\S+\s*/g) ?? [full];
      let lo = 1;
      let hi = tokens.length - 1;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        kid.textContent = tokens.slice(0, mid).join("");
        if (fits()) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (best === 0) {
        target.removeChild(kid);
        remainderKids = [document.createTextNode(full), ...rest];
      } else {
        kid.textContent = tokens.slice(0, best).join("");
        remainderKids = [
          document.createTextNode(tokens.slice(best).join("")),
          ...rest,
        ];
      }
    } else if (
      kid.nodeType === Node.ELEMENT_NODE &&
      SPLITTABLE.has((kid as Element).tagName)
    ) {
      target.removeChild(kid);
      const kidShell = (kid as Element).cloneNode(false) as Element;
      target.appendChild(kidShell);
      if (!fits()) {
        target.removeChild(kidShell);
        remainderKids = [kid, ...rest];
      } else {
        const kidRemainder = fillFrom(kid as Element, kidShell, fits);
        if (kidShell.childNodes.length === 0) target.removeChild(kidShell);
        remainderKids = kidRemainder ? [kidRemainder, ...rest] : [...rest];
      }
    } else {
      target.removeChild(kid);
      remainderKids = [kid, ...rest];
    }

    if (remainderKids.length === 0) return null;
    const rem = source.cloneNode(false) as Element;
    remainderKids.forEach((k) => rem.appendChild(k));

    // Keep ordered-list numbering continuous across the split.
    if (rem.tagName === "OL") {
      const consumed = target.querySelectorAll(":scope > li").length;
      const prevStart = parseInt(source.getAttribute("start") ?? "1", 10) || 1;
      rem.setAttribute("start", String(prevStart + consumed));
    }
    return rem;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pagination cache — reopening the same tome at the same size skips the
// whole measurement pass. Session-scoped: it dies with the tab.
// ---------------------------------------------------------------------------

const CACHE_MAX_BYTES = 2_000_000;

export function pageCacheKey(html: string, pageW: number, pageH: number): string {
  // djb2 over the content — collisions are astronomically unlikely at this
  // scale, and a collision only mis-renders until the next repagination.
  let hash = 5381;
  for (let i = 0; i < html.length; i++) {
    hash = ((hash << 5) + hash + html.charCodeAt(i)) | 0;
  }
  return `tome-pages:${hash}:${pageW}x${pageH}`;
}

export function readPageCache(key: string): string[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return Array.isArray(value) && value.every((p) => typeof p === "string")
      ? value
      : null;
  } catch {
    return null;
  }
}

export function writePageCache(key: string, pages: string[]): void {
  try {
    const raw = JSON.stringify(pages);
    if (raw.length > CACHE_MAX_BYTES) return;
    sessionStorage.setItem(key, raw);
  } catch {
    // Storage full or unavailable — the cache is purely an optimization.
  }
}
