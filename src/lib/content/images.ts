import { db } from "@/db";
import { journalImages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { newId } from "@/lib/id";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export async function storeImage(
  journalId: string,
  contentType: string,
  data: Buffer
): Promise<string | null> {
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(normalized) || data.length > MAX_IMAGE_BYTES) {
    return null;
  }
  const id = newId();
  await db.insert(journalImages).values({
    id,
    journalId,
    contentType: normalized,
    data,
  });
  return `/api/images/${id}`;
}

export async function deleteImagesForJournal(journalId: string) {
  await db.delete(journalImages).where(eq(journalImages.journalId, journalId));
}

/**
 * Finds <img src="..."> occurrences pointing at remote URLs or data: URIs,
 * stores the bytes locally, and rewrites the src to /api/images/<id>.
 * Images that can't be fetched/stored are left for the sanitizer to strip.
 */
export async function localizeImages(
  html: string,
  journalId: string
): Promise<string> {
  const srcRegex = /<img\b[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)')/gi;
  const sources = new Set<string>();
  for (const match of html.matchAll(srcRegex)) {
    const src = match[2] ?? match[3];
    if (src && !src.startsWith("/api/images/")) sources.add(src);
  }

  const replacements = new Map<string, string>();
  for (const src of sources) {
    try {
      const local = await captureImage(src, journalId);
      if (local) replacements.set(src, local);
    } catch {
      // Unfetchable image — sanitizer will strip the broken src later.
    }
  }

  if (replacements.size === 0) return html;

  return html.replace(srcRegex, (full, _quoted, dq, sq) => {
    const src = dq ?? sq;
    const local = replacements.get(src);
    return local ? full.replace(src, local) : full;
  });
}

async function captureImage(
  src: string,
  journalId: string
): Promise<string | null> {
  if (src.startsWith("data:")) {
    const match = /^data:([^;,]+);base64,(.*)$/s.exec(src);
    if (!match) return null;
    return storeImage(journalId, match[1], Buffer.from(match[2], "base64"));
  }
  if (!/^https:\/\//i.test(src)) return null;
  const res = await fetch(src, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") ?? "";
  const data = Buffer.from(await res.arrayBuffer());
  return storeImage(journalId, contentType, data);
}
