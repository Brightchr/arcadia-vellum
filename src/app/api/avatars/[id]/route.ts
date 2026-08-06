import { db } from "@/db";
import { profileImages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jsonError } from "@/lib/api";

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
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
