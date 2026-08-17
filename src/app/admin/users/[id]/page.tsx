import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { shellData } from "@/lib/nav";
import { isAdmin, adminUserDetail } from "@/lib/admin";
import { appThemeClass } from "@/lib/themes";
import { AppShell } from "@/components/nav/AppShell";
import { Avatar } from "@/components/nav/Avatar";
import { Stars } from "@/components/discover/StarRating";
import { BanControls } from "@/components/admin/BanControls";
import { WorkBanButton } from "@/components/admin/WorkBanButton";
import { banReasonLabel } from "@/lib/ban-reasons";
import type { RelatedUser } from "@/lib/social";

export const metadata: Metadata = {
  title: "Admin — Vellum",
};

// Moderation data must never be cached or statically rendered.
export const dynamic = "force-dynamic";

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function ts(d: Date): string {
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function UserChips({ users, empty }: { users: RelatedUser[]; empty: string }) {
  if (users.length === 0) {
    return <p className="text-sm text-ink-dim italic">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {users.map((u) => (
        <li key={u.id}>
          <Link
            href={u.username ? `/u/${u.username}` : "#"}
            className="inline-flex items-center gap-2 rounded-full bg-overlay border border-edge pl-1 pr-3 py-1 text-xs hover:border-arcane/50 transition-colors"
          >
            <Avatar name={u.name} avatarImageId={u.avatarImageId} size={22} />
            <span className="font-heading">{u.name}</span>
            {u.username && (
              <span className="text-ink-dim">@{u.username}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Admin-only inspection of one account: content, social graph, activity. */
export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { session, navUser, pins, unread } = await shellData();
  if (!session || !navUser) redirect("/login");
  if (!(await isAdmin(session.user.id))) notFound();

  const { id } = await params;
  const detail = await adminUserDetail(id);
  if (!detail) notFound();
  const { profile } = detail;

  const audiobooks = detail.works.filter((w) => w.sourceType === "audio");
  const writings = detail.works.filter((w) => w.sourceType !== "audio");
  const audioBytes = detail.audio.reduce((sum, a) => sum + a.bytes, 0);

  const stat = (label: string, value: string | number) => (
    <div className="panel-arcane px-4 py-3">
      <p className="font-display text-xl text-arcane-bright">{value}</p>
      <p className="text-[11px] font-heading uppercase tracking-widest text-ink-dim">
        {label}
      </p>
    </div>
  );

  const section = (title: string, body: React.ReactNode) => (
    <section className="panel-arcane p-5">
      <h2 className="font-heading text-lg mb-3">{title}</h2>
      {body}
    </section>
  );

  return (
    <main
      className={`${appThemeClass(navUser.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppShell user={navUser} pins={pins} unreadNotifications={unread}>
        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10 space-y-6">
          <p className="text-xs font-heading text-ink-dim">
            <Link href="/admin" className="hover:text-arcane-bright">
              Admin Dashboard
            </Link>{" "}
            / Account inspection
          </p>

          {/* Identity + moderation controls */}
          <header className="panel-arcane p-5 flex flex-wrap items-center gap-4">
            <Avatar
              name={profile.name}
              avatarImageId={profile.avatarImageId}
              size={64}
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl text-arcane-bright">
                {profile.name}
                {profile.role === "admin" && (
                  <span className="ml-2 align-middle inline-flex items-center rounded-full bg-arcane/20 border border-arcane/50 px-2 py-0.5 text-[10px] font-heading uppercase tracking-widest text-arcane-bright">
                    Admin
                  </span>
                )}
                {profile.banned && (
                  <span className="ml-2 align-middle inline-flex items-center rounded-full bg-red-500/15 border border-red-500/40 px-2 py-0.5 text-[10px] font-heading uppercase tracking-widest text-red-400">
                    Banned
                  </span>
                )}
              </h1>
              <p className="text-sm text-ink-dim">
                {profile.username ? `@${profile.username} · ` : ""}
                {profile.email} · joined {ts(profile.createdAt)}
                {profile.bannedAt ? ` · banned ${ts(profile.bannedAt)}` : ""}
                {profile.banned && profile.bannedUntil
                  ? ` · until ${ts(profile.bannedUntil)}`
                  : ""}
              </p>
              {profile.banned && (
                <p className="text-sm text-red-400/90 mt-0.5">
                  Reason: {banReasonLabel(profile.banReason)}
                </p>
              )}
            </div>
            {profile.role !== "admin" && (
              <BanControls
                userId={profile.id}
                name={profile.name}
                username={profile.username}
                banned={profile.banned}
              />
            )}
          </header>

          {/* Inventory counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {stat("Writings", writings.length)}
            {stat("Audiobooks", audiobooks.length)}
            {stat("Series", detail.series.length)}
            {stat("Images", detail.images.length)}
            {stat("Audio files", detail.audio.length)}
            {stat("Playlists", detail.playlists.length)}
            {stat("Reviews", detail.reviews.length)}
            {stat("Audio size", fmtBytes(audioBytes))}
          </div>

          {/* Social graph */}
          <div className="grid gap-4 lg:grid-cols-3">
            {section(
              `Followers (${detail.followers.length})`,
              <UserChips users={detail.followers} empty="No followers." />
            )}
            {section(
              `Following (${detail.following.length})`,
              <UserChips users={detail.following} empty="Not following anyone." />
            )}
            {section(
              `Friends (${detail.friends.length})`,
              <UserChips users={detail.friends} empty="No friends." />
            )}
          </div>

          {/* Recent activity */}
          {section(
            "Recent Activity",
            detail.events.length === 0 ? (
              <p className="text-sm text-ink-dim italic">No activity yet.</p>
            ) : (
              <ol className="space-y-1.5 max-h-96 overflow-y-auto pr-2">
                {detail.events.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-3 text-sm border-b border-void-border/40 last:border-0 pb-1.5"
                  >
                    <span className="text-xs text-ink-dim whitespace-nowrap w-40 shrink-0">
                      {ts(e.at)}
                    </span>
                    {e.href ? (
                      <Link
                        href={e.href}
                        className="min-w-0 hover:text-arcane-bright transition-colors"
                      >
                        {e.label}
                      </Link>
                    ) : (
                      <span className="min-w-0">{e.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            )
          )}

          {/* Works */}
          {section(
            `Works (${detail.works.length})`,
            detail.works.length === 0 ? (
              <p className="text-sm text-ink-dim italic">No works.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-heading uppercase tracking-wider text-ink-dim border-b border-void-border">
                      <th className="pr-4 py-2">Title</th>
                      <th className="pr-4 py-2">Type</th>
                      <th className="pr-4 py-2">Visibility</th>
                      <th className="pr-4 py-2">Created</th>
                      <th className="pr-4 py-2">Review</th>
                      <th className="py-2 text-right">Moderation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.works.map((w) => (
                      <tr
                        key={w.id}
                        className="border-b border-void-border/40 last:border-0"
                      >
                        <td className="pr-4 py-2">
                          <Link
                            href={`/book/${w.slug}`}
                            className="hover:text-arcane-bright transition-colors"
                          >
                            {w.title}
                          </Link>
                          {w.bannedAt && (
                            <span
                              className="ml-2 inline-flex items-center rounded-full bg-red-500/15 border border-red-500/40 px-1.5 py-0.5 text-[9px] font-heading uppercase tracking-widest text-red-400"
                              title={`${banReasonLabel(w.banReason)} — ${ts(w.bannedAt)}`}
                            >
                              Banned
                            </span>
                          )}
                        </td>
                        <td className="pr-4 py-2 text-ink-dim">
                          {w.sourceType === "audio" ? "audiobook" : w.sourceType}
                        </td>
                        <td className="pr-4 py-2 text-ink-dim">
                          {w.visibility}
                          {!w.listed ? " (unlisted)" : ""}
                        </td>
                        <td className="pr-4 py-2 text-ink-dim whitespace-nowrap">
                          {ts(w.createdAt)}
                        </td>
                        <td className="pr-4 py-2 whitespace-nowrap">
                          <Link
                            href={
                              w.sourceType === "audio"
                                ? `/j/${w.slug}/listen`
                                : `/j/${w.slug}`
                            }
                            className="text-xs text-arcane-bright hover:underline"
                          >
                            {w.sourceType === "audio" ? "Listen" : "Read"}
                          </Link>
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <WorkBanButton
                            journalId={w.id}
                            title={w.title}
                            banned={Boolean(w.bannedAt)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Images */}
          {section(
            `Images (${detail.images.length})`,
            detail.images.length === 0 ? (
              <p className="text-sm text-ink-dim italic">No images.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">
                {detail.images.map((img) => (
                  <a
                    key={img.id}
                    href={`/api/images/${img.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`${img.journalTitle} — ${ts(img.createdAt)} (${fmtBytes(img.bytes)})`}
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/images/${img.id}`}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full object-cover rounded-md border border-edge hover:border-arcane/60 transition-colors"
                    />
                  </a>
                ))}
              </div>
            )
          )}

          {/* Profile images: avatars, banners, theme textures */}
          {section(
            `Profile Images (${detail.profileImages.length})`,
            detail.profileImages.length === 0 ? (
              <p className="text-sm text-ink-dim italic">
                No uploaded avatars, banners, or textures.
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">
                {detail.profileImages.map((img) => (
                  <a
                    key={img.id}
                    href={`/api/avatars/${img.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`${img.contentType} — ${ts(img.createdAt)}`}
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/avatars/${img.id}`}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full object-cover rounded-md border border-edge hover:border-arcane/60 transition-colors"
                    />
                  </a>
                ))}
              </div>
            )
          )}

          {/* Audio files — playable so reported narration can be reviewed */}
          {section(
            `Audio Files (${detail.audio.length})`,
            detail.audio.length === 0 ? (
              <p className="text-sm text-ink-dim italic">No audio.</p>
            ) : (
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-2 text-sm">
                {detail.audio.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 border-b border-void-border/40 last:border-0 pb-2"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {a.title}
                      <span className="text-ink-dim"> — {a.journalTitle}</span>
                      <span className="block text-xs text-ink-dim">
                        {fmtBytes(a.bytes)} · {ts(a.createdAt)}
                      </span>
                    </span>
                    <audio
                      controls
                      preload="none"
                      src={`/api/audio/${a.id}`}
                      className="h-9 max-w-72"
                    />
                  </li>
                ))}
              </ul>
            )
          )}

          {/* Network: known sign-in addresses and active IP bans */}
          {section(
            "Network",
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-heading uppercase tracking-wider text-ink-dim mb-1">
                  Known sign-in IPs (latest first)
                </p>
                {detail.knownIps.length === 0 ? (
                  <p className="text-ink-dim italic">No recorded addresses.</p>
                ) : (
                  <p className="font-mono text-xs break-all">
                    {detail.knownIps.join(" · ")}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-heading uppercase tracking-wider text-ink-dim mb-1">
                  Active IP bans tied to this account
                </p>
                {detail.ipBans.length === 0 ? (
                  <p className="text-ink-dim italic">None.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {detail.ipBans.map((b) => (
                      <li key={b.ip} className="font-mono text-xs">
                        {b.ip}
                        <span className="font-sans text-ink-dim">
                          {" "}
                          — {banReasonLabel(b.reason)} · added {ts(b.createdAt)}
                          {b.expiresAt
                            ? ` · expires ${ts(b.expiresAt)}`
                            : " · permanent"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-xs text-ink-dim">
                IP bans are created from the ban dialog (&quot;also ban their
                known IP addresses&quot;) and lifted automatically when the
                account is unbanned.
              </p>
            </div>
          )}

          {/* Reviews they wrote */}
          {section(
            `Reviews Written (${detail.reviews.length})`,
            detail.reviews.length === 0 ? (
              <p className="text-sm text-ink-dim italic">No reviews.</p>
            ) : (
              <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {detail.reviews.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      {r.itemHref ? (
                        <Link
                          href={r.itemHref}
                          className="font-heading text-arcane-bright hover:underline"
                        >
                          {r.itemTitle ?? "A removed work"}
                        </Link>
                      ) : (
                        <span className="font-heading">
                          {r.itemTitle ?? "A removed work"}
                        </span>
                      )}
                      <Stars value={r.rating} size={12} />
                      <span className="text-xs text-ink-dim">
                        {ts(r.updatedAt)}
                      </span>
                    </span>
                    {r.body && (
                      <p className="text-ink-dim mt-0.5 whitespace-pre-wrap">
                        {r.body}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )
          )}

          {/* Playlists */}
          {section(
            `Playlists (${detail.playlists.length})`,
            detail.playlists.length === 0 ? (
              <p className="text-sm text-ink-dim italic">No playlists.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {detail.playlists.map((p) => (
                  <li key={p.id} className="flex items-baseline gap-2">
                    <Link
                      href={`/playlists/${p.id}`}
                      className="hover:text-arcane-bright transition-colors"
                    >
                      {p.icon ? `${p.icon} ` : ""}
                      {p.name}
                    </Link>
                    <span className="text-xs text-ink-dim">
                      {p.count} item{p.count === 1 ? "" : "s"} · {p.visibility} ·
                      created {ts(p.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}

          {/* Moderation history */}
          {section(
            "Moderation History",
            detail.moderation.length === 0 ? (
              <p className="text-sm text-ink-dim italic">
                No moderation actions on this account.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {detail.moderation.map((m, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span className="text-xs text-ink-dim whitespace-nowrap w-40 shrink-0">
                      {ts(m.createdAt)}
                    </span>
                    <span>
                      <span
                        className={
                          m.action.startsWith("ban")
                            ? "text-red-400"
                            : "text-emerald-400"
                        }
                      >
                        {m.action}
                      </span>{" "}
                      by {m.adminName}
                      {m.details ? ` — ${m.details}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </AppShell>
    </main>
  );
}
