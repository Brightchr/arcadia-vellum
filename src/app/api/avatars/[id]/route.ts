import { db } from "@/db";
import { profileImages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jsonError } from "@/lib/api";
import { mediaResponse } from "@/lib/media";

export const runtime = "nodejs";

/** Avatars are public (they appear on reviews and profiles). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(profileImages)
    .where(eq(profileImages.id, id));
  const image = rows[0];
  if (!image) return jsonError("Not found", 404);
  return mediaResponse(image, "public, max-age=3600");
}
