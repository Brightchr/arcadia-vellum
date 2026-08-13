import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { shellData } from "@/lib/nav";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import {
  listGroupsForUser,
  listPublicGroups,
  type GroupSummary,
} from "@/lib/groups";
import { CreateGroupPanel } from "@/components/groups/CreateGroupPanel";
import { JoinGroupButton } from "@/components/groups/JoinGroupButton";
import { MessageSquareIcon, UsersIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Groups — Vellum",
};

function GroupTile({
  g,
  showJoin,
}: {
  g: GroupSummary;
  showJoin?: boolean;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-overlay-strong text-xl"
      >
        {g.icon ?? <MessageSquareIcon className="h-5 w-5 text-ink-dim" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-heading text-sm">{g.name}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-dim">
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="h-3 w-3" />
            {g.memberCount}
          </span>
          {g.onlineCount > 0 && (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {g.onlineCount} online
            </span>
          )}
          {g.visibility === "private" && <span>Private</span>}
        </span>
        {g.description && (
          <span className="mt-1 block truncate text-xs text-ink-dim">
            {g.description}
          </span>
        )}
      </span>
    </>
  );

  if (g.joined) {
    return (
      <Link
        href={`/groups/${g.id}`}
        className="panel-arcane flex items-center gap-3 p-4 transition-colors hover:border-arcane/60"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="panel-arcane flex items-center gap-3 p-4">
      {inner}
      {showJoin && <JoinGroupButton groupId={g.id} />}
    </div>
  );
}

export default async function GroupsPage() {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");

  const [mine, directory] = await Promise.all([
    listGroupsForUser(session.user.id),
    listPublicGroups(session.user.id),
  ]);
  const discover = directory.filter((g) => !g.joined);

  return (
    <main
      className={`${appThemeClass(navUser.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell
        user={navUser}
        active="groups"
        pins={pins}
        unreadNotifications={unread}
      >
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8 space-y-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl text-ink">Groups</h1>
              <p className="text-sm text-ink-dim">
                Reading circles for your table — chat, share works, and see
                who&apos;s around.
              </p>
            </div>
            <CreateGroupPanel />
          </header>

          <section>
            <h2 className="font-heading text-lg mb-3">
              Your Groups {mine.length > 0 && `(${mine.length})`}
            </h2>
            {mine.length === 0 ? (
              <div className="panel-arcane p-10 text-center">
                <p className="font-heading text-xl mb-2">No groups yet.</p>
                <p className="text-ink-dim">
                  Create one for your campaign, or join a public group below.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mine.map((g) => (
                  <GroupTile key={g.id} g={g} />
                ))}
              </div>
            )}
          </section>

          {discover.length > 0 && (
            <section>
              <h2 className="font-heading text-lg mb-3">Discover</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {discover.map((g) => (
                  <GroupTile key={g.id} g={g} showJoin />
                ))}
              </div>
            </section>
          )}
        </div>
      </AppShell>
    </main>
  );
}
