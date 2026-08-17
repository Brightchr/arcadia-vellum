import { auth } from "@/lib/auth";

export async function sessionFromRequest(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * Reject oversized upload bodies BEFORE request.formData() buffers them all
 * into memory. Per-file checks alone don't help — by the time they run, the
 * whole multipart body is already resident. Bodies without a Content-Length
 * are refused too (browsers always send one for FormData uploads).
 */
export function bodyTooLarge(
  request: Request,
  maxBytes: number
): Response | null {
  const length = Number(request.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > maxBytes) {
    return jsonError(
      `Upload too large (max ${Math.floor(maxBytes / 1024 / 1024)} MB per request)`,
      413
    );
  }
  return null;
}
