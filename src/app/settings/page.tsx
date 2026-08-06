import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import { getUserById } from "@/lib/profile";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { ProfileSettingsForm } from "@/components/social/ProfileSettingsForm";

export const metadata: Metadata = {
  title: "Settings — Vellum",
};

export default async function SettingsPage() {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");
  const me = await getUserById(session.user.id);
  if (!me) redirect("/login");

  return (
    <main
      className={`${appThemeClass(navUser.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
      <div className="max-w-3xl mx-auto p-4 sm:p-6 md:p-10">
        <header className="mb-8">
          <h1 className="font-display text-2xl text-arcane-bright">Settings</h1>
          <p className="text-sm text-ink-dim">
            Your public identity and privacy.
          </p>
        </header>
        <ProfileSettingsForm
          profile={{
            name: me.name,
            username: me.username,
            bio: me.bio,
            avatarImageId: me.avatarImageId,
            bannerImageId: me.bannerImageId,
            profileVisibility: me.profileVisibility,
            allowFriendRequests: me.allowFriendRequests,
            showSavedOnProfile: me.showSavedOnProfile,
            showPlaylistsOnProfile: me.showPlaylistsOnProfile,
            showCountsOnProfile: me.showCountsOnProfile,
            searchable: me.searchable,
            profileLayout: (() => {
              try {
                const parsed = JSON.parse(me.profileLayout ?? "null");
                return Array.isArray(parsed) ? (parsed as string[]) : null;
              } catch {
                return null;
              }
            })(),
          }}
        />
      </div>
      </AppShell>
    </main>
  );
}
