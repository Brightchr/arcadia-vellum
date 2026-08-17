import { sessionFromRequest, jsonError, bodyTooLarge } from "@/lib/api";
import { saveProfileImage } from "@/lib/media";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";
import { sniffImageType } from "@/lib/sniff";

export const runtime = "nodejs";

const MAX_TEXTURE_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Upload a tiling texture for the theme builder. Stored alongside profile
 * images (user-owned, served publicly via /api/avatars/<id>) and referenced
 * from theme configs by id. Multipart field: file.
 */
export async function POST(request: Request) {
  // Shares the profile-image budget with avatar/banner uploads.
  const limited = rateLimit(request, "profile-image", {
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const userLimited = rateLimitUser(session.user.id, "profile-image", {
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (userLimited) return userLimited;
  const tooLarge = bodyTooLarge(request, MAX_TEXTURE_BYTES + 64 * 1024);
  if (tooLarge) return tooLarge;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("An image is required", 400);

  const data = Buffer.from(await file.arrayBuffer());
  // Type comes from the bytes, not the client-declared file.type.
  const contentType = sniffImageType(data);
  if (!contentType || !ALLOWED.has(contentType) || data.length > MAX_TEXTURE_BYTES) {
    return jsonError("Use a .png, .jpg, or .webp under 2 MB", 400);
  }

  const id = await saveProfileImage(session.user.id, contentType, data);
  return Response.json({ id, url: `/api/avatars/${id}` });
}
