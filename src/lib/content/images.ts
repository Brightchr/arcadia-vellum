import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { db } from "@/db";
import { journalImages, journals } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { deleteObjects, saveJournalImage } from "@/lib/media";
import { sniffImageType } from "@/lib/sniff";

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
  // The stored type comes from the bytes — `contentType` arrives from
  // client-declared uploads, data: URIs, or remote servers, none of which
  // we trust to describe what gets served back from /api/images.
  void contentType;
  const sniffed = sniffImageType(data);
  if (
    !sniffed ||
    !ALLOWED_IMAGE_TYPES.has(sniffed) ||
    data.length > MAX_IMAGE_BYTES
  ) {
    return null;
  }
  const id = await saveJournalImage(journalId, sniffed, data);
  return `/api/images/${id}`;
}

/**
 * Clears a journal's stored content images (before a re-sync/re-upload
 * stores fresh ones). The cover art is NOT content — it survives.
 */
export async function deleteImagesForJournal(journalId: string) {
  const [journal] = await db
    .select({ coverImageId: journals.coverImageId })
    .from(journals)
    .where(eq(journals.id, journalId));
  const keep = journal?.coverImageId;
  const removed = await db
    .delete(journalImages)
    .where(
      keep
        ? and(eq(journalImages.journalId, journalId), ne(journalImages.id, keep))
        : eq(journalImages.journalId, journalId)
    )
    .returning({ storageKey: journalImages.storageKey });
  await deleteObjects(removed.map((r) => r.storageKey));
}

/**
 * Finds <img src="..."> occurrences pointing at remote URLs or data: URIs,
 * stores the bytes locally, and rewrites the src to /api/images/<id>.
 * Images that can't be fetched/stored are left for the sanitizer to strip.
 */
// One document can't turn the server into a fetch cannon.
const MAX_REMOTE_IMAGES_PER_DOC = 50;

export async function localizeImages(
  html: string,
  journalId: string
): Promise<string> {
  const srcRegex = /<img\b[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)')/gi;
  const sources = new Set<string>();
  for (const match of html.matchAll(srcRegex)) {
    const src = match[2] ?? match[3];
    if (src && !src.startsWith("/api/images/")) sources.add(src);
    if (sources.size >= MAX_REMOTE_IMAGES_PER_DOC) break;
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
  const data = await fetchRemoteImage(src);
  if (!data) return null;
  return storeImage(journalId, "", data);
}

/**
 * Fetches a remote image with SSRF guards: https only, no credentials or
 * custom ports, the resolved address must be public, redirects are refused
 * (a redirect could bounce the request somewhere the checks never saw), and
 * the body is read through a hard size cap instead of trusting
 * Content-Length.
 */
async function fetchRemoteImage(src: string): Promise<Buffer | null> {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return null;
  }
  try {
    const { address } = await lookup(url.hostname);
    if (isPrivateIp(address)) return null;
  } catch {
    return null;
  }

  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!res.ok || !res.body) return null;
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return null;

  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/** Loopback, link-local, RFC-1918, CGNAT, and their IPv6 equivalents. */
function isPrivateIp(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link local
  return false;
}
