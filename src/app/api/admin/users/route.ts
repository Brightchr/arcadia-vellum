import { sessionFromRequest, jsonError } from "@/lib/api";
import { isAdmin, listUsersForAdmin } from "@/lib/admin";

export const runtime = "nodejs";

/** Admin-only: search/list all accounts, banned included (?q=). */
export async function GET(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session || !(await isAdmin(session.user.id))) {
    return jsonError("Not found", 404);
  }
  const q = new URL(request.url).searchParams.get("q") ?? undefined;
  const users = await listUsersForAdmin(q);
  return Response.json(
    {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        email: u.email,
        avatarImageId: u.avatarImageId,
        role: u.role,
        banned: u.banned,
        bannedAt: u.bannedAt,
        createdAt: u.createdAt,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
