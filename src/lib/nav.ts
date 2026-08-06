import { getSession } from "@/lib/auth";
import { listSeriesForOwner } from "@/lib/series";
import { listSaved } from "@/lib/saves";
import { unreadCount } from "@/lib/notifications";
import type { NavUser, SidebarPin } from "@/components/nav/AppShell";

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

/** Everything the AppShell needs: user, sidebar pins, unread notifications. */
export async function shellData() {
  const { session, navUser } = await sessionWithNav();
  if (!session || !navUser) {
    return {
      session: null,
      navUser: null as NavUser | null,
      pins: [] as SidebarPin[],
      unread: 0,
    };
  }
  const [own, saved, unread] = await Promise.all([
    listSeriesForOwner(session.user.id),
    listSaved(session.user.id),
    unreadCount(session.user.id),
  ]);
  const pins: SidebarPin[] = [
    ...own.map((s) => ({
      key: `own:${s.id}`,
      label: s.name,
      href: `/series/${s.slug}`,
      icon: s.icon,
      pinKind: "series" as const,
      itemKind: "series" as const,
      itemId: s.id,
    })),
    ...saved.map((s) => ({
      key: `saved:${s.kind}:${s.id}`,
      label: s.title,
      href: s.kind === "series" ? `/series/${s.slug}` : `/book/${s.slug}`,
      icon: s.icon,
      pinKind: "saved" as const,
      itemKind: s.kind,
      itemId: s.id,
    })),
  ];
  return { session, navUser, pins, unread };
}

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof sessionWithNav>>["session"]
>["user"] &
  SessionProfileFields;
