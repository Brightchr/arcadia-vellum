import { searchUsers } from "@/lib/profile";

export const runtime = "nodejs";

/**
 * Look up scribes by @username or display name (?q=). Public endpoint —
 * only searchable, non-private profiles with a username are returned.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const users = await searchUsers(q);
  return Response.json({
    users: users.map((u) => ({
      name: u.name,
      username: u.username,
      avatarImageId: u.avatarImageId,
      bio: u.bio,
    })),
  });
}
