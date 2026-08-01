import { auth } from "@/lib/auth";

/**
 * Server-side access token for the user's linked Google account.
 * Better Auth refreshes it automatically if expired.
 */
export async function getGoogleAccessToken(
  userId: string
): Promise<string | null> {
  try {
    const result = await auth.api.getAccessToken({
      body: { providerId: "google", userId },
    });
    return result?.accessToken ?? null;
  } catch {
    return null;
  }
}

export type DriveExportResult =
  | { ok: true; html: string }
  | { ok: false; error: string; needsRelink?: boolean };

/** Export a Google Doc as HTML via the Drive API (works with drive.file scope). */
export async function exportDocAsHtml(
  accessToken: string,
  fileId: string
): Promise<DriveExportResult> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId
  )}/export?mimeType=${encodeURIComponent("text/html")}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      needsRelink: true,
      error:
        "Google denied access to this document. Re-link your Google account or re-pick the document.",
    };
  }
  if (res.status === 404) {
    return {
      ok: false,
      needsRelink: true,
      error:
        "The linked Google Doc was not found. It may have been deleted, or access wasn't granted — pick it again.",
    };
  }
  if (!res.ok) {
    return { ok: false, error: `Google Drive export failed (${res.status}).` };
  }
  return { ok: true, html: await res.text() };
}
