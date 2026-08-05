import mammoth from "mammoth";
import { marked } from "marked";
import { sanitizeJournalHtml, plainTextLength } from "./sanitize";
import { localizeImages, storeImage, deleteImagesForJournal } from "./images";
import { db } from "@/db";
import { journalContent, journals } from "@/db/schema";
import { eq } from "drizzle-orm";

export type UploadKind = "docx" | "md" | "txt";

export function detectUploadKind(filename: string): UploadKind | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".txt")) return "txt";
  return null;
}

/** Converts an uploaded file to raw HTML (pre-sanitization). */
export async function uploadToHtml(
  kind: UploadKind,
  buffer: Buffer,
  journalId: string
): Promise<string> {
  switch (kind) {
    case "docx": {
      const result = await mammoth.convertToHtml(
        { buffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            const data = Buffer.from(await image.readAsBase64String(), "base64");
            const src = await storeImage(journalId, image.contentType ?? "", data);
            return { src: src ?? "" };
          }),
        }
      );
      return result.value;
    }
    case "md":
      return marked.parse(await stripBom(buffer), { async: false });
    case "txt": {
      const text = await stripBom(buffer);
      return text
        .split(/\r?\n\s*\r?\n/)
        .map((para) => `<p>${escapeHtml(para.trim()).replace(/\r?\n/g, "<br>")}</p>`)
        .join("\n");
    }
  }
}

/**
 * Final step for every source: localize remote/data images, sanitize, and
 * store as the journal's content. Clears previously stored images first so
 * re-syncs/re-uploads don't accumulate orphans.
 */
export async function setJournalContent(
  journalId: string,
  rawHtml: string,
  opts: { imagesAlreadyLocal?: boolean } = {}
): Promise<void> {
  const localized = opts.imagesAlreadyLocal
    ? rawHtml
    : await localizeImages(rawHtml, journalId);
  const html = sanitizeJournalHtml(localized);
  const plainLength = plainTextLength(html);

  await db
    .insert(journalContent)
    .values({ journalId, html, plainLength, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: journalContent.journalId,
      set: { html, plainLength, updatedAt: new Date() },
    });
  await db
    .update(journals)
    .set({ lastSyncedAt: new Date() })
    .where(eq(journals.id, journalId));
}

/**
 * Save content written in the built-in editor: markdown → html through the
 * same localize/sanitize pipeline, keeping the markdown source for re-editing.
 */
export async function saveWrittenContent(
  journalId: string,
  markdown: string
): Promise<void> {
  const rawHtml = marked.parse(markdown, { async: false });
  await setJournalContent(journalId, rawHtml);
  await db
    .update(journalContent)
    .set({ sourceMd: markdown })
    .where(eq(journalContent.journalId, journalId));
}

/** Ingest an upload end-to-end: convert → localize → sanitize → store. */
export async function ingestUpload(
  journalId: string,
  filename: string,
  buffer: Buffer
): Promise<{ ok: true } | { ok: false; error: string }> {
  const kind = detectUploadKind(filename);
  if (!kind) {
    return { ok: false, error: "Unsupported file type. Use .docx, .md, or .txt." };
  }
  // Re-upload replaces content; drop old images before mammoth stores new ones.
  await deleteImagesForJournal(journalId);
  const rawHtml = await uploadToHtml(kind, buffer, journalId);
  await setJournalContent(journalId, rawHtml, {
    imagesAlreadyLocal: kind === "docx",
  });
  return { ok: true };
}

async function stripBom(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8").replace(/^﻿/, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
