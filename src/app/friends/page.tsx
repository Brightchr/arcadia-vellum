import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import {
  listPendingRequests,
  listFollowing,
  listFollowers,
} from "@/lib/social";
import { friendsWithPresence } from "@/lib/presence";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { FriendsPanel } from "@/components/social/FriendsPanel";
import { UserSearch } from "@/components/social/UserSearch";

export const metadata: Metadata = {
  title: "Friends — Vellum",
};

export default async function FriendsPage() {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");

  const [friends, pending, following, followers] = await Promise.all([
    friendsWithPresence(session.user.id),
    listPendingRequests(session.user.id),
    listFollowing(session.user.id),
    listFollowers(session.user.id),
  ]);

  return (
    <main
      className={`${appThemeClass(navUser.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell user={navUser} active="friends" pins={pins} unreadNotifications={unread}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10">
        <header className="mb-8">
          <h1 className="font-display text-2xl text-ink">
            Friends &amp; Followers
          </h1>
          <p className="text-sm text-ink-dim">
            Your circle of scribes and listeners — see who&apos;s online and
            what they&apos;re reading.
          </p>
        </header>
        <section className="panel-arcane p-5 mb-5">
          <h2 className="font-heading text-lg mb-3">Find Scribes</h2>
          <UserSearch />
        </section>
        <FriendsPanel
          incoming={pending.incoming}
          outgoing={pending.outgoing}
          friends={friends}
          following={following}
          followers={followers}
        />
      </div>
      </AppShell>
    </main>
  );
}
