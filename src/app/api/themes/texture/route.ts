import { sessionFromRequest, jsonError } from "@/lib/api";
import { saveProfileImage } from "@/lib/media";

export const runtime = "nodejs";

const MAX_TEXTURE_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Upload a tiling texture for the theme builder. Stored alongside profile
 * images (user-owned, served publicly via /api/avatars/<id>) and referenced
 * from theme configs by id. Multipart field: file.
 */
export async function POST(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("An image is required", 400);

  const contentType = file.type.split(";")[0].trim().toLowerCase();
  if (!ALLOWED.has(contentType) || file.size > MAX_TEXTURE_BYTES) {
    return jsonError("Use a .png, .jpg, or .webp under 2 MB", 400);
  }

  const id = await saveProfileImage(
    session.user.id,
    contentType,
    Buffer.from(await file.arrayBuffer())
  );
  return Response.json({ id, url: `/api/avatars/${id}` });
}
