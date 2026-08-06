import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sessionFromRequest, jsonError } from "@/lib/api";
import { usernameProblem, isUsernameTaken } from "@/lib/profile";
import { isTextSafe, UNSAFE_TEXT_ERROR } from "@/lib/safety";

export const runtime = "nodejs";

/**
 * Update the signed-in user's profile: username, bio, and privacy settings.
 * All safety/uniqueness validation lives here (client updateUser can't touch
 * these fields).
 */
export async function PATCH(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session) return jsonError("Not signed in", 401);
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return jsonError("Invalid JSON body", 400);

  const patch: Partial<typeof user.$inferInsert> = {};

  if (typeof body.username === "string") {
    const username = body.username.trim().toLowerCase();
    const problem = usernameProblem(username);
    if (problem) return jsonError(problem, 400);
    if (await isUsernameTaken(username, session.user.id)) {
      return jsonError("That username is taken", 400);
    }
    patch.username = username;
  }

  if (typeof body.bio === "string") {
    const bio = body.bio.trim().slice(0, 500);
    if (bio && !isTextSafe(bio)) return jsonError(UNSAFE_TEXT_ERROR, 400);
    patch.bio = bio || null;
  }

  if (
    body.profileVisibility === "public" ||
    body.profileVisibility === "friends" ||
    body.profileVisibility === "private"
  ) {
    patch.profileVisibility = body.profileVisibility;
  }
  if (typeof body.allowFriendRequests === "boolean") {
    patch.allowFriendRequests = body.allowFriendRequests;
  }
  if (typeof body.showSavedOnProfile === "boolean") {
    patch.showSavedOnProfile = body.showSavedOnProfile;
  }
  if (Array.isArray(body.profileLayout)) {
    const allowed = new Set(["bio", "featured", "works", "saved"]);
    const layout = (body.profileLayout as unknown[]).filter(
      (s): s is string => typeof s === "string" && allowed.has(s)
    );
    patch.profileLayout = JSON.stringify([...new Set(layout)]);
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("Nothing to update", 400);
  }
  patch.updatedAt = new Date();

  await db.update(user).set(patch).where(eq(user.id, session.user.id));
  return Response.json({ ok: true });
}
