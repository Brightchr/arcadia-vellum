import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError, bodyTooLarge } from "@/lib/api";
import { removeProfileImage, saveProfileImage } from "@/lib/media";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";
import { sniffImageType } from "@/lib/sniff";

export const runtime = "nodejs";

// Banners are wide header images, so they get more room than avatars.
const MAX_BANNER_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Set the profile banner (owner). Multipart field: file */
export async function POST(request: Request) {
  // Shares the profile-image budget with avatar/texture uploads.
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
  const tooLarge = bodyTooLarge(request, MAX_BANNER_BYTES + 64 * 1024);
  if (tooLarge) return tooLarge;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("An image is required", 400);
  const data = Buffer.from(await file.arrayBuffer());
  // Type comes from the bytes, not the client-declared file.type.
  const type = sniffImageType(data);
  if (!type || !ALLOWED.has(type) || data.length > MAX_BANNER_BYTES) {
    return jsonError("Use a .png, .jpg, .gif, or .webp under 5 MB", 400);
  }

  const rows = await db
    .select({ bannerImageId: user.bannerImageId })
    .from(user)
    .where(eq(user.id, session.user.id));
  await removeProfileImage(rows[0]?.bannerImageId ?? null);

  const id = await saveProfileImage(session.user.id, type, data);
  await db
    .update(user)
    .set({ bannerImageId: id, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  return Response.json({ bannerUrl: `/api/avatars/${id}` });
}

export async function DELETE(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const rows = await db
    .select({ bannerImageId: user.bannerImageId })
    .from(user)
    .where(eq(user.id, session.user.id));
  await removeProfileImage(rows[0]?.bannerImageId ?? null);
  await db
    .update(user)
    .set({ bannerImageId: null, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  return Response.json({ ok: true });
}
