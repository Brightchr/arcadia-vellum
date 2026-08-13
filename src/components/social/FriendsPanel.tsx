"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/nav/Avatar";
import type { RelatedUser } from "@/lib/social";
import type { FriendPresence } from "@/lib/presence";
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@/components/icons";

/** Avatar with a Steam-style presence dot pinned to its corner. */
function PresenceAvatar({
  u,
  online,
  size = 36,
}: {
  u: RelatedUser;
  online?: boolean;
  size?: number;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={u.name} avatarImageId={u.avatarImageId} size={size} />
      {online !== undefined && (
        <span
          aria-hidden
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-void-raised ${
            online ? "bg-emerald-400" : "bg-ink-dim/50"
          }`}
        />
      )}
    </span>
  );
}

function UserRow({
  u,
  online,
  status,
  children,
}: {
  u: RelatedUser;
  online?: boolean;
  status?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-overlay">
      <PresenceAvatar u={u} online={online} />
      <div className="min-w-0 flex-1">
        {u.username ? (
          <Link
            href={`/u/${u.username}`}
            className="text-sm font-heading text-arcane-bright hover:underline truncate block"
          >
            {u.name}
          </Link>
        ) : (
          <span className="text-sm font-heading truncate block">{u.name}</span>
        )}
        {status ??
          (u.username && (
            <span className="text-xs text-ink-dim">@{u.username}</span>
          ))}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </li>
  );
}

/** The status line under a friend's name: reading activity, or Online/Offline. */
function FriendStatus({ f }: { f: FriendPresence }) {
  if (f.online && f.activityLabel) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400 min-w-0">
        <BookOpenIcon className="h-3 w-3 shrink-0" />
        {f.activityHref ? (
          <Link href={f.activityHref} className="truncate hover:underline">
            {f.activityLabel}
          </Link>
        ) : (
          <span className="truncate">{f.activityLabel}</span>
        )}
      </span>
    );
  }
  return (
    <span
      className={`text-xs ${f.online ? "text-emerald-400/90" : "text-ink-dim"}`}
    >
      {f.online ? "Online" : "Offline"}
    </span>
  );
}

export function FriendsPanel({
  incoming,
  outgoing,
  friends,
  following,
  followers,
}: {
  incoming: RelatedUser[];
  outgoing: RelatedUser[];
  friends: FriendPresence[];
  following: RelatedUser[];
  followers: RelatedUser[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showOffline, setShowOffline] = useState(true);

  async function act(fn: () => Promise<Response>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const online = friends.filter((f) => f.online);
  const offline = friends.filter((f) => !f.online);

  const removeButton = (u: RelatedUser, label: string) => (
    <button
      type="button"
      className="btn-ghost text-xs px-3 py-1.5"
      disabled={busy}
      onClick={() =>
        act(() => fetch(`/api/friends/${u.id}`, { method: "DELETE" }))
      }
    >
      {label}
    </button>
  );

  const section = (title: string, empty: string, body: React.ReactNode) => (
    <section className="panel-arcane p-5">
      <h2 className="font-heading text-lg mb-3">{title}</h2>
      {body ?? <p className="text-sm text-ink-dim italic">{empty}</p>}
    </section>
  );

  return (
    <div className="space-y-5">
      {incoming.length > 0 &&
        section(
          `Friend Requests (${incoming.length})`,
          "",
          <ul className="space-y-1">
            {incoming.map((u) => (
              <UserRow key={u.id} u={u}>
                <button
                  type="button"
                  className="btn-arcane text-xs px-3 py-1.5"
                  disabled={busy}
                  onClick={() =>
                    act(() => fetch(`/api/friends/${u.id}`, { method: "PATCH" }))
                  }
                >
                  Accept
                </button>
                {removeButton(u, "Decline")}
              </UserRow>
            ))}
          </ul>
        )}

      {/* Steam-style roster: who's on right now, then everyone else */}
      <section className="panel-arcane p-5">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="font-heading text-lg">Friends</h2>
          <p className="text-xs text-ink-dim">
            <span className="text-emerald-400 font-semibold">
              {online.length}
            </span>{" "}
            of {friends.length} online
          </p>
        </div>
        {friends.length === 0 ? (
          <p className="text-sm text-ink-dim italic">
            No friends yet — find scribes with the search above and send a
            request from their profile.
          </p>
        ) : (
          <>
            <p className="px-3 text-[11px] font-heading uppercase tracking-widest text-emerald-400/80 mb-1">
              Online — {online.length}
            </p>
            {online.length === 0 ? (
              <p className="px-3 pb-2 text-sm text-ink-dim italic">
                Nobody&apos;s in the archives right now.
              </p>
            ) : (
              <ul className="space-y-1 mb-3">
                {online.map((f) => (
                  <UserRow
                    key={f.id}
                    u={f}
                    online
                    status={<FriendStatus f={f} />}
                  >
                    {removeButton(f, "Remove")}
                  </UserRow>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="px-3 text-[11px] font-heading uppercase tracking-widest text-ink-dim hover:text-ink transition-colors"
              onClick={() => setShowOffline((v) => !v)}
            >
              <span className="inline-flex items-center gap-1">
                Offline — {offline.length}
                {showOffline ? (
                  <ChevronDownIcon className="h-3 w-3" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3" />
                )}
              </span>
            </button>
            {showOffline && offline.length > 0 && (
              <ul className="space-y-1 mt-1 opacity-70">
                {offline.map((f) => (
                  <UserRow
                    key={f.id}
                    u={f}
                    online={false}
                    status={<FriendStatus f={f} />}
                  >
                    {removeButton(f, "Remove")}
                  </UserRow>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {outgoing.length > 0 &&
        section(
          `Sent Requests (${outgoing.length})`,
          "",
          <ul className="space-y-1">
            {outgoing.map((u) => (
              <UserRow key={u.id} u={u}>
                {removeButton(u, "Cancel")}
              </UserRow>
            ))}
          </ul>
        )}

      <div className="grid gap-5 lg:grid-cols-2">
        {section(
          `Following (${following.length})`,
          "You aren't following anyone yet.",
          following.length > 0 ? (
            <ul className="space-y-1">
              {following.map((u) => (
                <UserRow key={u.id} u={u}>
                  <button
                    type="button"
                    className="btn-ghost text-xs px-3 py-1.5"
                    disabled={busy}
                    onClick={() =>
                      act(() =>
                        fetch(`/api/follow/${u.id}`, { method: "DELETE" })
                      )
                    }
                  >
                    Unfollow
                  </button>
                </UserRow>
              ))}
            </ul>
          ) : null
        )}

        {section(
          `Followers (${followers.length})`,
          "No followers yet — share your public works to gather readers.",
          followers.length > 0 ? (
            <ul className="space-y-1">
              {followers.map((u) => (
                <UserRow key={u.id} u={u} />
              ))}
            </ul>
          ) : null
        )}
      </div>
    </div>
  );
}
