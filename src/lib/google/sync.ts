import type { Journal } from "@/lib/journals";
import { getGoogleAccessToken, exportDocAsHtml } from "./drive";
import { setJournalContent } from "@/lib/content/ingest";
import { deleteImagesForJournal } from "@/lib/content/images";

export type SyncResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

const AUTO_SYNC_STALE_MS = 10 * 60 * 1000;

export function isSyncStale(journal: Journal): boolean {
  if (!journal.lastSyncedAt) return true;
  return Date.now() - journal.lastSyncedAt.getTime() > AUTO_SYNC_STALE_MS;
}

/** Pull the linked Google Doc's current content into the journal. */
export async function syncJournalFromDrive(
  journal: Journal
): Promise<SyncResult> {
  if (journal.sourceType !== "gdoc" || !journal.gdocFileId) {
    return {
      ok: false,
      error: "This journal is not linked to a Google Doc.",
      status: 400,
    };
  }

  const accessToken = await getGoogleAccessToken(journal.ownerId);
  if (!accessToken) {
    return {
      ok: false,
      error:
        "No Google account with Drive access is linked. Connect Google Drive and try again.",
      status: 409,
    };
  }

  const exported = await exportDocAsHtml(accessToken, journal.gdocFileId);
  if (!exported.ok) {
    return { ok: false, error: exported.error, status: 502 };
  }

  await deleteImagesForJournal(journal.id);
  await setJournalContent(journal.id, exported.html);
  return { ok: true };
}

/**
 * Fire-and-forget freshness check used when the owner opens their journal.
 * Errors are swallowed — the reader shows the last synced content.
 */
export async function autoSyncIfStale(journal: Journal): Promise<void> {
  if (journal.sourceType !== "gdoc" || !isSyncStale(journal)) return;
  try {
    await syncJournalFromDrive(journal);
  } catch {
    // Keep serving cached content.
  }
}
