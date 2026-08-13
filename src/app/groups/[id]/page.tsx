import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import {
  getGroup,
  hasInvite,
  invitableFriends,
  listChannelsForUser,
  listMembersWithPresence,
  listRanks,
  memberRole,
  mutedGroupIds,
} from "@/lib/groups";
import { listFriends } from "@/lib/social";
import { GroupView } from "@/components/groups/GroupView";
import { JoinGroupButton } from "@/components/groups/JoinGroupButton";
import { GroupAvatar } from "@/components/groups/GroupAvatar";
import { UsersIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Group — Vellum",
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");
  const { id } = await params;

  const group = await getGroup(id);
  if (!group) notFound();

  const role = await memberRole(id, session.user.id);

  // Non-members see a join card (public groups and standing invites only).
  if (!role) {
    const invited = await hasInvite(id, session.user.id);
    if (group.visibility === "private" && !invited) notFound();
    const members = await listMembersWithPresence(id);
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
          <div className="max-w-lg mx-auto p-4 sm:p-6 md:p-10">
            <div className="panel-arcane p-8 text-center space-y-3">
              <span className="mx-auto block w-fit">
                <GroupAvatar
                  imageId={group.imageId}
                  icon={group.icon}
                  className="h-16 w-16"
                  iconClassName="text-3xl"
                />
              </span>
              <h1 className="font-display text-2xl text-ink">{group.name}</h1>
              {group.description && (
                <p className="text-sm text-ink-dim">{group.description}</p>
              )}
              <p className="flex items-center justify-center gap-2 text-xs text-ink-dim">
                <UsersIcon className="h-3.5 w-3.5" />
                {members.length} member{members.length === 1 ? "" : "s"}
                {members.filter((m) => m.online).length > 0 && (
                  <span className="text-emerald-400">
                    · {members.filter((m) => m.online).length} online
                  </span>
                )}
              </p>
              {invited && (
                <p className="text-xs text-arcane-bright">
                  You&apos;ve been invited to this group.
                </p>
              )}
              <JoinGroupButton groupId={group.id} />
            </div>
          </div>
        </AppShell>
      </main>
    );
  }

  const [channels, members, friends, ranks, mutedGroups] = await Promise.all([
    listChannelsForUser(id, session.user.id),
    listMembersWithPresence(id),
    listFriends(session.user.id),
    listRanks(id),
    mutedGroupIds(session.user.id),
  ]);
  const invitable = await invitableFriends(id, friends);

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
        <GroupView
          group={{
            id: group.id,
            name: group.name,
            description: group.description,
            icon: group.icon,
            imageId: group.imageId,
            visibility: group.visibility,
            welcomeMessage: group.welcomeMessage,
          }}
          role={role}
          meId={session.user.id}
          channels={channels}
          members={members}
          ranks={ranks}
          invitable={invitable}
          groupMuted={mutedGroups.has(id)}
        />
      </AppShell>
    </main>
  );
}
