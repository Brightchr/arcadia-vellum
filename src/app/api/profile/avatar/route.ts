import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { removeProfileImage, saveProfileImage } from "@/lib/media";
import { rateLimit, rateLimitUser } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Set the avatar (owner). Multipart field: file */
export async function POST(request: Request) {
  // Shared budget across avatar/banner/texture — they're all "store an
  // image in profile_images".
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

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("An image is required", 400);
  const type = file.type.split(";")[0].trim().toLowerCase();
  if (!ALLOWED.has(type) || file.size > MAX_AVATAR_BYTES) {
    return jsonError("Use a .png, .jpg, .gif, or .webp under 2 MB", 400);
  }

  const rows = await db
    .select({ avatarImageId: user.avatarImageId })
    .from(user)
    .where(eq(user.id, session.user.id));
  await removeProfileImage(rows[0]?.avatarImageId ?? null);

  const id = await saveProfileImage(
    session.user.id,
    type,
    Buffer.from(await file.arrayBuffer())
  );
  await db
    .update(user)
    .set({ avatarImageId: id, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  return Response.json({ avatarUrl: `/api/avatars/${id}` });
}

export async function DELETE(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const rows = await db
    .select({ avatarImageId: user.avatarImageId })
    .from(user)
    .where(eq(user.id, session.user.id));
  await removeProfileImage(rows[0]?.avatarImageId ?? null);
  await db
    .update(user)
    .set({ avatarImageId: null, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  return Response.json({ ok: true });
}
