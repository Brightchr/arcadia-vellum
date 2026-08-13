import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { removeProfileImage, saveProfileImage } from "@/lib/media";

export const runtime = "nodejs";

// Banners are wide header images, so they get more room than avatars.
const MAX_BANNER_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

/** Set the profile banner (owner). Multipart field: file */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("An image is required", 400);
  const type = file.type.split(";")[0].trim().toLowerCase();
  if (!ALLOWED.has(type) || file.size > MAX_BANNER_BYTES) {
    return jsonError("Use a .png, .jpg, .gif, or .webp under 5 MB", 400);
  }

  const rows = await db
    .select({ bannerImageId: user.bannerImageId })
    .from(user)
    .where(eq(user.id, session.user.id));
  await removeProfileImage(rows[0]?.bannerImageId ?? null);

  const id = await saveProfileImage(
    session.user.id,
    type,
    Buffer.from(await file.arrayBuffer())
  );
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
