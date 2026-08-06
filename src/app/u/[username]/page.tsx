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
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { Avatar } from "@/components/nav/Avatar";
import { WorkCard } from "@/components/discover/WorkCard";
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
  return { title: `@${username} — Arcadia Vellum` };
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

  const allWorks = visible
    ? (await listPublicWorks()).filter((w) => w.ownerId === profile.id)
    : [];
  // Featured first: a series counts as featured if any volume is featured.
  const featuredIds = visible
    ? await featuredWorkKeys(profile.id)
    : new Set<string>();
  const featured = allWorks.filter((w) => featuredIds.has(`${w.kind}:${w.id}`));
  const rest = allWorks.filter((w) => !featuredIds.has(`${w.kind}:${w.id}`));

  const layout: string[] = (() => {
    try {
      const parsed = JSON.parse(profile.profileLayout ?? "null");
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // fall through to default
    }
    return ["bio", "featured", "works", "saved"];
  })();

  const savedWorks =
    visible && profile.showSavedOnProfile
      ? await (async () => {
          const saved = await listSaved(profile.id);
          const keys = new Set(saved.map((s) => `${s.kind}:${s.id}`));
          return (await listPublicWorks()).filter((w) =>
            keys.has(`${w.kind}:${w.id}`)
          );
        })()
      : [];

  return (
    <main
      className={`${appThemeClass(navUser?.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10 space-y-8">
        <header className="flex flex-wrap items-start gap-5">
          <Avatar
            name={profile.name}
            avatarImageId={profile.avatarImageId}
            size={88}
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl text-arcane-bright">
              {profile.name}
            </h1>
            <p className="text-sm text-ink-dim">@{profile.username}</p>
            <p className="text-xs text-ink-dim mt-2">
              {counts.followers} follower{counts.followers === 1 ? "" : "s"} ·{" "}
              {counts.following} following · {counts.friends} friend
              {counts.friends === 1 ? "" : "s"}
            </p>
          </div>
          <div className="shrink-0">
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
            <p className="font-heading text-xl mb-2">This profile is private.</p>
            <p className="text-ink-dim">
              {profile.profileVisibility === "friends"
                ? "Only friends can see this scribe's works."
                : "This scribe keeps their library to themselves."}
            </p>
          </div>
        ) : (
          // The writer arranges (and hides) these sections in Settings.
          layout.map((sectionKey) => {
            switch (sectionKey) {
              case "bio":
                return profile.bio ? (
                  <section key="bio" className="panel-arcane p-5 max-w-2xl">
                    <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>
                  </section>
                ) : null;
              case "featured":
                return featured.length > 0 ? (
                  <section key="featured">
                    <h2 className="font-heading text-lg mb-3">
                      Featured Works
                    </h2>
                    <div className="grid gap-4 sm:gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {featured.map((w) => (
                        <WorkCard key={`${w.kind}:${w.id}`} work={w} />
                      ))}
                    </div>
                  </section>
                ) : null;
              case "works":
                return (
                  <section key="works">
                    <h2 className="font-heading text-lg mb-3">
                      {featured.length > 0 ? "All Works" : "Works"}
                    </h2>
                    {rest.length === 0 && featured.length === 0 ? (
                      <p className="text-sm text-ink-dim italic">
                        No public works yet.
                      </p>
                    ) : (
                      <div className="grid gap-4 sm:gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {rest.map((w) => (
                          <WorkCard key={`${w.kind}:${w.id}`} work={w} />
                        ))}
                      </div>
                    )}
                  </section>
                );
              case "saved":
                return savedWorks.length > 0 ? (
                  <section key="saved">
                    <h2 className="font-heading text-lg mb-3">Saved Shelf</h2>
                    <div className="grid gap-4 sm:gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      {savedWorks.map((w) => (
                        <WorkCard key={`${w.kind}:${w.id}`} work={w} />
                      ))}
                    </div>
                  </section>
                ) : null;
              default:
                return null;
            }
          })
        )}
      </div>
      </AppShell>
    </main>
  );
}
