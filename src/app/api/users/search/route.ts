import { searchUsers } from "@/lib/profile";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Look up scribes by @username or display name (?q=). Public endpoint —
 * only searchable, non-private profiles with a username are returned.
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "user-search", {
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;
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
