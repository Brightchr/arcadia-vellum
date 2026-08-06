import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { sessionWithNav } from "@/lib/nav";
import { getUserById } from "@/lib/profile";
import { appThemeClass } from "@/lib/themes";
import { AppNav } from "@/components/nav/AppNav";
import { ProfileSettingsForm } from "@/components/social/ProfileSettingsForm";

export const metadata: Metadata = {
  title: "Settings — Arcadia Vellum",
};

export default async function SettingsPage() {
  const { session, navUser } = await sessionWithNav();
  if (!session || !navUser) redirect("/login");
  const me = await getUserById(session.user.id);
  if (!me) redirect("/login");

  return (
    <main
      className={`${appThemeClass(navUser.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppNav user={navUser} />
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
            profileVisibility: me.profileVisibility,
            allowFriendRequests: me.allowFriendRequests,
            showSavedOnProfile: me.showSavedOnProfile,
          }}
        />
      </div>
    </main>
  );
}
