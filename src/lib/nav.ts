import { getSession } from "@/lib/auth";
import type { NavUser } from "@/components/nav/AppNav";

interface SessionProfileFields {
  username?: string | null;
  avatarImageId?: string | null;
  bio?: string | null;
  dashboardTheme?: string;
  profileVisibility?: string;
  allowFriendRequests?: boolean;
  showSavedOnProfile?: boolean;
}

/** Session plus the NavUser shape the top navigation needs. */
export async function sessionWithNav() {
  const session = await getSession();
  if (!session) return { session: null, navUser: null as NavUser | null };
  const u = session.user as typeof session.user & SessionProfileFields;
  const navUser: NavUser = {
    name: u.name,
    username: u.username ?? null,
    avatarImageId: u.avatarImageId ?? null,
    dashboardTheme: u.dashboardTheme,
  };
  return { session, navUser };
}

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof sessionWithNav>>["session"]
>["user"] &
  SessionProfileFields;
