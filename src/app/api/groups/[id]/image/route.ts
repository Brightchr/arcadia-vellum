import { db } from "@/db";
import { groups } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError, bodyTooLarge } from "@/lib/api";
import { canModerate, getGroup, memberRole } from "@/lib/groups";
import { removeProfileImage, saveProfileImage } from "@/lib/media";
import { rateLimit } from "@/lib/rate-limit";
import { sniffImageType } from "@/lib/sniff";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

async function guard(request: Request, id: string) {
  const session = await sessionFromRequest(request);
  if (!session) return { error: jsonError("Not signed in", 401) };
  const group = await getGroup(id);
  if (!group) return { error: jsonError("Group not found", 404) };
  if (!canModerate(await memberRole(id, session.user.id))) {
    return { error: jsonError("Only the owner and admins can do that", 403) };
  }
  return { session, group };
}

/** Set the group's avatar image (owner/admin). Multipart field: file */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(request, "group-image", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const tooLarge = bodyTooLarge(request, MAX_BYTES + 64 * 1024);
  if (tooLarge) return tooLarge;
  const { id } = await params;
  const g = await guard(request, id);
  if ("error" in g) return g.error;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("An image is required", 400);
  const data = Buffer.from(await file.arrayBuffer());
  // Type comes from the bytes, not the client-declared file.type.
  const type = sniffImageType(data);
  if (!type || !ALLOWED.has(type) || data.length > MAX_BYTES) {
    return jsonError("Use a .png, .jpg, .gif, or .webp under 2 MB", 400);
  }

  await removeProfileImage(g.group.imageId);
  const imageId = await saveProfileImage(g.session.user.id, type, data);
  await db.update(groups).set({ imageId }).where(eq(groups.id, id));
  return Response.json({ imageUrl: `/api/avatars/${imageId}` });
}

/** Remove the group's avatar image (falls back to the emoji icon). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const g = await guard(request, id);
  if ("error" in g) return g.error;
  await removeProfileImage(g.group.imageId);
  await db.update(groups).set({ imageId: null }).where(eq(groups.id, id));
  return Response.json({ ok: true });
}
