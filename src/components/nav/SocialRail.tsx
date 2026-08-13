"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { GroupAvatar } from "@/components/groups/GroupAvatar";
import type { FriendPresence } from "@/lib/presence";
import type { GroupSummary } from "@/lib/groups";
import {
  BellIcon,
  BellOffIcon,
  BookOpenIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  PinIcon,
  UsersIcon,
} from "@/components/icons";

const REFRESH_MS = 60_000;

interface SocialAlert {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  actorName: string | null;
  actorUsername: string | null;
  actorAvatarId: string | null;
  itemTitle: string | null;
  itemHref: string | null;
}

type RailGroup = GroupSummary & { unread: boolean; muted: boolean };

interface RailData {
  friends: FriendPresence[];
  groups: RailGroup[];
  alerts: SocialAlert[];
  unread: number;
}

function alertText(a: SocialAlert): string {
  const who = a.actorName ?? "Someone";
  switch (a.type) {
    case "friend_request":
      return `${who} sent you a friend request`;
    case "friend_accept":
      return `${who} accepted your friend request`;
    case "new_follower":
      return `${who} started following you`;
    case "group_invite":
      return `${who} invited you to ${a.itemTitle ?? "a group"}`;
    default:
      return "Something happened";
  }
}

function alertHref(a: SocialAlert): string {
  if (a.type === "group_invite") return a.itemHref ?? "/groups";
  if (a.type === "new_follower" && a.actorUsername) return `/u/${a.actorUsername}`;
  return "/friends";
}

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-void-raised ${
        online ? "bg-emerald-400" : "bg-ink-dim/50"
      }`}
    />
  );
}

/**
 * The right-hand social rail (desktop): who's online, your groups (pinnable),
 * and social alerts — friends/groups noise stays out of the system bell.
 * Collapses to an avatar strip via html[data-rail-collapsed].
 */
export function SocialRail() {
  const [data, setData] = useState<RailData | null>(null);
  const [tab, setTab] = useState<"friends" | "groups" | "alerts">("friends");
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/social");
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // Retry on the next tick.
    }
  }, []);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem("av-rail-collapsed") === "1";
    } catch {
      // Storage blocked — leave expanded.
    }
    setCollapsed(stored);
    if (stored) document.documentElement.dataset.railCollapsed = "1";
    else delete document.documentElement.dataset.railCollapsed;

    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("av-rail-collapsed", next ? "1" : "0");
        document.cookie = `av-rail-collapsed=${next ? "1" : "0"};path=/;max-age=31536000;samesite=lax`;
      } catch {
        // Storage blocked — the toggle still works for this page.
      }
      if (next) document.documentElement.dataset.railCollapsed = "1";
      else delete document.documentElement.dataset.railCollapsed;
      return next;
    });
  }

  async function openAlerts() {
    setTab("alerts");
    if ((data?.unread ?? 0) > 0) {
      setData((d) => (d ? { ...d, unread: 0 } : d));
      await fetch("/api/social", { method: "POST" }).catch(() => {});
    }
  }

  async function toggleMute(g: RailGroup) {
    setData((d) =>
      d
        ? {
            ...d,
            groups: d.groups.map((x) =>
              x.id === g.id
                ? { ...x, muted: !g.muted, unread: g.muted ? x.unread : false }
                : x
            ),
          }
        : d
    );
    await fetch(`/api/groups/${g.id}/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted: !g.muted }),
    }).catch(() => {});
  }

  async function togglePin(g: RailGroup) {
    setData((d) =>
      d
        ? {
            ...d,
            groups: [...d.groups]
              .map((x) => (x.id === g.id ? { ...x, pinned: !g.pinned } : x))
              .sort(
                (a, b) =>
                  Number(b.pinned) - Number(a.pinned) ||
                  a.name.localeCompare(b.name)
              ),
          }
        : d
    );
    await fetch(`/api/groups/${g.id}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !g.pinned }),
    }).catch(() => {});
  }

  const friends = data?.friends ?? [];
  const online = friends.filter((f) => f.online);
  const groups = data?.groups ?? [];
  const alerts = data?.alerts ?? [];
  const unread = data?.unread ?? 0;

  const tabBtn = (
    key: typeof tab,
    label: string,
    badge?: number,
    onClick?: () => void
  ) => (
    <button
      type="button"
      className={`relative flex-1 rounded-md px-1 py-1.5 text-[11px] font-heading uppercase tracking-wider transition-colors ${
        tab === key
          ? "bg-arcane/15 text-arcane-bright"
          : "text-ink-dim hover:text-ink hover:bg-overlay"
      }`}
      onClick={onClick ?? (() => setTab(key))}
    >
      {label}
      {(badge ?? 0) > 0 && (
        <span className="absolute -top-1 -right-0.5 min-w-4 rounded-full bg-arcane px-1 text-[9px] font-bold leading-4 text-(--btn-ink)">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <aside className="app-social-rail hidden lg:flex shrink-0 flex-col border-l sticky top-0 h-dvh transition-[width] duration-200">
      <div className="flex h-14 shrink-0 items-center justify-between px-2 railc:justify-center">
        <p className="railc:hidden px-2 text-[10px] font-heading uppercase tracking-[0.2em] text-ink-dim">
          Your Circle
        </p>
        <button
          type="button"
          aria-label={collapsed ? "Expand social rail" : "Collapse social rail"}
          title={collapsed ? "Expand" : "Collapse"}
          className="p-2 rounded-md text-ink-dim hover:text-ink hover:bg-overlay transition-colors"
          onClick={toggleCollapsed}
        >
          <ChevronRightIcon
            className={`h-4 w-4 ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Collapsed: online avatars + a groups shortcut */}
      {collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-1 py-2">
          {online.slice(0, 12).map((f) => (
            <Link
              key={f.id}
              href={f.username ? `/u/${f.username}` : "/friends"}
              title={
                f.activityLabel ? `${f.name} — ${f.activityLabel}` : f.name
              }
              className="relative"
            >
              <Avatar name={f.name} avatarImageId={f.avatarImageId} size={32} />
              <PresenceDot online />
            </Link>
          ))}
          <Link
            href="/groups"
            title="Groups"
            className="relative mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-overlay text-ink-dim hover:text-ink"
          >
            <MessageSquareIcon className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-arcane" />
            )}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex gap-1 px-2 pb-2">
            {tabBtn("friends", "Friends")}
            {tabBtn("groups", "Groups", groups.filter((g) => g.unread).length)}
            {tabBtn("alerts", "Alerts", unread, () => void openAlerts())}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {data === null ? (
              <p className="px-2 py-4 text-xs text-ink-dim">Loading…</p>
            ) : tab === "friends" ? (
              <>
                <p className="px-2 pb-1 text-[10px] font-heading uppercase tracking-widest text-emerald-400/80">
                  Online — {online.length}
                </p>
                {online.length === 0 && (
                  <p className="px-2 pb-2 text-xs text-ink-dim italic">
                    Nobody&apos;s around right now.
                  </p>
                )}
                <ul className="space-y-0.5">
                  {online.map((f) => (
                    <li key={f.id}>
                      <Link
                        href={f.username ? `/u/${f.username}` : "/friends"}
                        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-overlay"
                      >
                        <span className="relative shrink-0">
                          <Avatar
                            name={f.name}
                            avatarImageId={f.avatarImageId}
                            size={30}
                          />
                          <PresenceDot online />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm">
                            {f.name}
                          </span>
                          {f.activityLabel ? (
                            <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                              <BookOpenIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {f.activityLabel}
                              </span>
                            </span>
                          ) : (
                            <span className="block text-[11px] text-emerald-400/90">
                              Online
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {friends.length > online.length && (
                  <p className="px-2 pt-3 pb-1 text-[10px] font-heading uppercase tracking-widest text-ink-dim/70">
                    Offline — {friends.length - online.length}
                  </p>
                )}
                <ul className="space-y-0.5 opacity-60">
                  {friends
                    .filter((f) => !f.online)
                    .slice(0, 15)
                    .map((f) => (
                      <li key={f.id}>
                        <Link
                          href={f.username ? `/u/${f.username}` : "/friends"}
                          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-overlay"
                        >
                          <span className="relative shrink-0">
                            <Avatar
                              name={f.name}
                              avatarImageId={f.avatarImageId}
                              size={30}
                            />
                            <PresenceDot online={false} />
                          </span>
                          <span className="truncate text-sm">{f.name}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
                <Link
                  href="/friends"
                  className="mt-2 block px-2 text-xs text-ink-dim hover:text-arcane-bright"
                >
                  Manage friends →
                </Link>
              </>
            ) : tab === "groups" ? (
              <>
                {groups.length === 0 && (
                  <p className="px-2 py-2 text-xs text-ink-dim italic">
                    Join or create a group to see it here.
                  </p>
                )}
                <ul className="space-y-0.5">
                  {groups.map((g) => (
                    <li
                      key={g.id}
                      className={`group/pin flex items-center ${
                        g.muted ? "opacity-50" : ""
                      }`}
                    >
                      <Link
                        href={`/groups/${g.id}`}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-overlay"
                      >
                        <span className="relative shrink-0">
                          <GroupAvatar
                            imageId={g.imageId}
                            icon={g.icon}
                            className="h-8 w-8"
                            iconClassName="text-base"
                          />
                          {g.unread && (
                            <span
                              aria-label="Unread messages"
                              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-void-raised bg-arcane"
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span
                            className={`block truncate text-sm ${
                              g.unread ? "font-bold" : ""
                            }`}
                          >
                            {g.name}
                            {g.muted && (
                              <BellOffIcon className="ml-1 inline h-3 w-3 text-ink-dim" />
                            )}
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px] text-ink-dim">
                            {g.onlineCount > 0 && (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                {g.onlineCount}
                              </span>
                            )}
                            {g.memberCount} member
                            {g.memberCount === 1 ? "" : "s"}
                          </span>
                        </span>
                      </Link>
                      <span className="flex shrink-0 items-center">
                        <button
                          type="button"
                          aria-label={g.muted ? `Unmute ${g.name}` : `Mute ${g.name}`}
                          title={g.muted ? "Unmute" : "Mute"}
                          className="p-1 text-xs text-ink-dim opacity-0 transition group-hover/pin:opacity-100 hover:text-ink"
                          onClick={() => void toggleMute(g)}
                        >
                          {g.muted ? (
                            <BellIcon className="h-3.5 w-3.5" />
                          ) : (
                            <BellOffIcon className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label={g.pinned ? `Unpin ${g.name}` : `Pin ${g.name}`}
                          title={g.pinned ? "Unpin" : "Pin to top"}
                          className={`p-1 text-sm transition ${
                            g.pinned
                              ? "text-arcane-bright"
                              : "text-ink-dim opacity-0 group-hover/pin:opacity-100 hover:text-ink"
                          }`}
                          onClick={() => void togglePin(g)}
                        >
                          <PinIcon
                            className="h-3.5 w-3.5"
                            filled={g.pinned}
                          />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/groups"
                  className="mt-2 block px-2 text-xs text-ink-dim hover:text-arcane-bright"
                >
                  All groups →
                </Link>
              </>
            ) : (
              <>
                {alerts.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-ink-dim italic">
                    No friend or group activity yet.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {alerts.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={alertHref(a)}
                          className={`flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-overlay ${
                            a.read ? "opacity-60" : ""
                          }`}
                        >
                          <Avatar
                            name={a.actorName ?? "?"}
                            avatarImageId={a.actorAvatarId}
                            size={28}
                          />
                          <span className="min-w-0">
                            <span className="block text-xs leading-snug">
                              {alertText(a)}
                            </span>
                            <span className="block text-[10px] text-ink-dim mt-0.5">
                              {new Date(a.createdAt).toLocaleString()}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
