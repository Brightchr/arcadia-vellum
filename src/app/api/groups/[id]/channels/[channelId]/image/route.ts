import { db } from "@/db";
import { groupChannels } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { sessionFromRequest, jsonError, bodyTooLarge } from "@/lib/api";
import { canModerate, getChannel, memberRole } from "@/lib/groups";
import { removeProfileImage, saveProfileImage } from "@/lib/media";
import { rateLimit } from "@/lib/rate-limit";
import { sniffImageType } from "@/lib/sniff";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

async function guard(request: Request, id: string, channelId: string) {
  const session = await sessionFromRequest(request);
  if (!session) return { error: jsonError("Not signed in", 401) };
  if (!canModerate(await memberRole(id, session.user.id))) {
    return { error: jsonError("Only the owner and admins can do that", 403) };
  }
  const channel = await getChannel(id, channelId);
  if (!channel) return { error: jsonError("Channel not found", 404) };
  return { session, channel };
}

/** Set a channel thumbnail (owner/admin). Multipart field: file */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const limited = rateLimit(request, "channel-image", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const tooLarge = bodyTooLarge(request, MAX_BYTES + 64 * 1024);
  if (tooLarge) return tooLarge;
  const { id, channelId } = await params;
  const g = await guard(request, id, channelId);
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

  await removeProfileImage(g.channel.imageId);
  const imageId = await saveProfileImage(g.session.user.id, type, data);
  await db
    .update(groupChannels)
    .set({ imageId })
    .where(
      and(eq(groupChannels.id, channelId), eq(groupChannels.groupId, id))
    );
  return Response.json({ imageUrl: `/api/avatars/${imageId}` });
}

/** Remove a channel thumbnail. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; channelId: string }> }
) {
  const { id, channelId } = await params;
  const g = await guard(request, id, channelId);
  if ("error" in g) return g.error;
  await removeProfileImage(g.channel.imageId);
  await db
    .update(groupChannels)
    .set({ imageId: null })
    .where(
      and(eq(groupChannels.id, channelId), eq(groupChannels.groupId, id))
    );
  return Response.json({ ok: true });
}
