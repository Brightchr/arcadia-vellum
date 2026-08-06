import { db } from "@/db";
import { profileImages, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { newId } from "@/lib/id";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

async function dropAvatar(avatarImageId: string | null) {
  if (avatarImageId) {
    await db.delete(profileImages).where(eq(profileImages.id, avatarImageId));
  }
}

/** Set the avatar (owner). Multipart field: file */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);

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
  await dropAvatar(rows[0]?.avatarImageId ?? null);

  const id = newId();
  await db.insert(profileImages).values({
    id,
    userId: session.user.id,
    contentType: type,
    data: Buffer.from(await file.arrayBuffer()),
  });
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
  await dropAvatar(rows[0]?.avatarImageId ?? null);
  await db
    .update(user)
    .set({ avatarImageId: null, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));
  return Response.json({ ok: true });
}
