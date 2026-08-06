import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import {
  getUserByUsername,
  canViewProfile,
  relationshipCounts,
} from "@/lib/profile";
import { isFollowing, friendshipBetween } from "@/lib/social";
import { listPublicWorks, featuredWorkKeys } from "@/lib/discovery";
import { listSaved } from "@/lib/saves";
import { listSharedPlaylists, playlistItemCounts } from "@/lib/playlists";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { Avatar } from "@/components/nav/Avatar";
import {
  ProfileTabs,
  type ProfilePlaylist,
  type ProfileTabKey,
} from "@/components/profile/ProfileTabs";
import {
  FollowFriendButtons,
  type FriendState,
} from "@/components/social/FollowFriendButtons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username} — Vellum` };
}

/** Section order → tab order; legacy "featured" folds into Works. */
function tabOrder(profileLayout: string | null): ProfileTabKey[] {
  let layout: string[] = ["works", "playlists", "saved", "bio"];
  try {
    const parsed = JSON.parse(profileLayout ?? "null");
    if (Array.isArray(parsed) && parsed.length > 0) layout = parsed;
  } catch {
    // default order
  }
  const tabs: ProfileTabKey[] = [];
  const push = (t: ProfileTabKey) => {
    if (!tabs.includes(t)) tabs.push(t);
  };
  for (const key of layout) {
    if (key === "works" || key === "featured") push("works");
    else if (key === "playlists") push("playlists");
    else if (key === "saved") push("saved");
    else if (key === "bio") push("about");
  }
  if (tabs.length === 0) tabs.push("works");
  return tabs;
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getUserByUsername(username);
  if (!profile || !profile.username) notFound();

  const { session, navUser, pins, unread } = await shellData();
  const viewerId = session?.user.id ?? null;
  const isSelf = viewerId === profile.id;
  const visible = await canViewProfile(profile, viewerId);

  // Banned accounts are hidden — visitors just see the notice.
  if (profile.banned && !isSelf) {
    return (
      <main
        className={`${appThemeClass(navUser?.dashboardTheme ?? "")} arcane-bg min-h-screen`}
      >
        <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
          <div className="max-w-6xl mx-auto p-4 sm:p-6 md:px-10 md:py-8">
            <div className="panel-arcane p-12 text-center">
              <p className="font-heading text-xl mb-2">
                This account has been banned.
              </p>
              <p className="text-ink-dim">
                Their works and reviews are no longer available on Vellum.
              </p>
            </div>
          </div>
        </AppShell>
      </main>
    );
  }

  const counts = await relationshipCounts(profile.id);
  let following = false;
  let friendState: FriendState = "none";
  if (viewerId && !isSelf) {
    following = await isFollowing(viewerId, profile.id);
    const f = await friendshipBetween(viewerId, profile.id);
    if (f) {
      friendState =
        f.status === "accepted"
          ? "friends"
          : f.requesterId === viewerId
            ? "pending_out"
            : "pending_in";
    }
  }

  // Everything below the header is gated by profile visibility.
  const allPublicWorks = visible ? await listPublicWorks() : [];
  const works = allPublicWorks.filter((w) => w.ownerId === profile.id);
  const featuredIds = visible
    ? await featuredWorkKeys(profile.id)
    : new Set<string>();

  const savedWorks =
    visible && profile.showSavedOnProfile
      ? await (async () => {
          const saved = await listSaved(profile.id);
          const keys = new Set(saved.map((s) => `${s.kind}:${s.id}`));
          return allPublicWorks.filter((w) => keys.has(`${w.kind}:${w.id}`));
        })()
      : [];

  const sharedPlaylists: ProfilePlaylist[] =
    visible && profile.showPlaylistsOnProfile
      ? await (async () => {
          const lists = await listSharedPlaylists(profile.id, viewerId);
          const itemCounts = await playlistItemCounts(lists.map((p) => p.id));
          return lists.map((p) => ({
            id: p.id,
            name: p.name,
            icon: p.icon,
            count: itemCounts.get(p.id) ?? 0,
            visibility: p.visibility,
          }));
        })()
      : [];

  // Tabs: layout sets the order; the privacy toggles gate Shelf/Playlists.
  const tabs = tabOrder(profile.profileLayout).filter((t) => {
    if (t === "saved") return profile.showSavedOnProfile;
    if (t === "playlists") return profile.showPlaylistsOnProfile;
    return true;
  });
  if (profile.showPlaylistsOnProfile && !tabs.includes("playlists")) {
    tabs.push("playlists");
  }

  const joined = profile.createdAt.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <main
      className={`${appThemeClass(navUser?.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:px-10 md:py-8 space-y-6">
          {/* Banner (only when the profile is visible to this viewer) */}
          {visible &&
            (profile.bannerImageId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/avatars/${profile.bannerImageId}`}
                alt=""
                className="w-full aspect-[4/1] min-h-28 max-h-64 object-cover rounded-2xl border border-white/10 shadow-xl shadow-black/30"
              />
            ) : (
              <div
                aria-hidden
                className="w-full aspect-[5/1] min-h-24 max-h-56 rounded-2xl border border-white/10 bg-gradient-to-r from-arcane/25 via-void-raised to-ember/15"
              />
            ))}

          {/* Identity row, avatar overlapping the banner */}
          <header
            className={`px-1 sm:px-3 flex flex-wrap items-end gap-4 ${
              visible ? "-mt-14 sm:-mt-16" : ""
            }`}
          >
            <span className="inline-flex rounded-full ring-4 ring-[var(--void)] bg-[var(--void)]">
              <Avatar
                name={profile.name}
                avatarImageId={profile.avatarImageId}
                size={104}
              />
            </span>
            <div className="min-w-0 flex-1 pb-1.5">
              <h1 className="font-display text-2xl sm:text-3xl text-arcane-bright leading-tight">
                {profile.name}
                {profile.role === "admin" && (
                  <span
                    className="ml-2.5 align-middle inline-flex items-center rounded-full bg-arcane/20 border border-arcane/50 px-2 py-0.5 text-[10px] font-heading uppercase tracking-widest text-arcane-bright"
                    title="Vellum administrator"
                  >
                    Admin
                  </span>
                )}
              </h1>
              <p className="text-sm text-ink-dim">
                @{profile.username}
                {profile.showCountsOnProfile && (
                  <>
                    {" · "}
                    {counts.followers} follower
                    {counts.followers === 1 ? "" : "s"} · {counts.following}{" "}
                    following · {counts.friends} friend
                    {counts.friends === 1 ? "" : "s"}
                  </>
                )}
              </p>
            </div>
            <div className="shrink-0 pb-1.5">
              {isSelf ? (
                <Link href="/settings" className="btn-ghost">
                  Edit Profile
                </Link>
              ) : (
                <FollowFriendButtons
                  targetId={profile.id}
                  following={following}
                  friendState={friendState}
                  allowRequests={profile.allowFriendRequests}
                  signedIn={!!session}
                />
              )}
            </div>
          </header>

          {!visible ? (
            <div className="panel-arcane p-12 text-center">
              <p className="font-heading text-xl mb-2">
                This profile is private.
              </p>
              <p className="text-ink-dim">
                {profile.profileVisibility === "friends"
                  ? "Only friends can see this scribe's works."
                  : "This scribe keeps their library to themselves."}
              </p>
            </div>
          ) : (
            <ProfileTabs
              tabs={tabs}
              works={works}
              featuredKeys={[...featuredIds]}
              playlists={sharedPlaylists}
              saved={savedWorks}
              bio={profile.bio}
              joined={joined}
              isSelf={isSelf}
            />
          )}
        </div>
      </AppShell>
    </main>
  );
}
