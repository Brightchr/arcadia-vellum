import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import { isAdmin, adminStats, listUsersForAdmin } from "@/lib/admin";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const metadata: Metadata = {
  title: "Admin — Vellum",
};

/** Moderation dashboard — admins only; 404 for everyone else. */
export default async function AdminPage() {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");
  if (!(await isAdmin(session.user.id))) notFound();

  const [stats, users] = await Promise.all([
    adminStats(),
    listUsersForAdmin(),
  ]);

  const stat = (label: string, value: number) => (
    <div className="panel-arcane px-5 py-4">
      <p className="font-display text-2xl text-arcane-bright">{value}</p>
      <p className="text-xs font-heading uppercase tracking-widest text-ink-dim">
        {label}
      </p>
    </div>
  );

  return (
    <main
      className={`${appThemeClass(navUser.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10 space-y-6">
          <header>
            <h1 className="font-display text-2xl text-arcane-bright">
              Admin Dashboard
            </h1>
            <p className="text-sm text-ink-dim">
              Moderate the realm: search accounts, ban, and unban. Banning
              hides a scribe&apos;s works, reviews, and profile, and notifies
              everyone who saved their work.
            </p>
          </header>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stat("Scribes", stats.users)}
            {stat("Banned", stats.banned)}
            {stat("Works", stats.works)}
            {stat("Reviews", stats.reviews)}
          </div>

          <AdminPanel
            initialUsers={users.map((u) => ({
              id: u.id,
              name: u.name,
              username: u.username,
              email: u.email,
              avatarImageId: u.avatarImageId,
              role: u.role,
              banned: u.banned,
              bannedAt: u.bannedAt ? u.bannedAt.toISOString() : null,
              createdAt: u.createdAt.toISOString(),
            }))}
          />
        </div>
      </AppShell>
    </main>
  );
}
