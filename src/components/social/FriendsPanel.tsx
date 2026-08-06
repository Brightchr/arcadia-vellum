"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/nav/Avatar";
import type { RelatedUser } from "@/lib/social";

function UserRow({
  u,
  children,
}: {
  u: RelatedUser;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5">
      <Avatar name={u.name} avatarImageId={u.avatarImageId} size={36} />
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
        {u.username && (
          <span className="text-xs text-ink-dim">@{u.username}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">{children}</div>
    </li>
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
  friends: RelatedUser[];
  following: RelatedUser[];
  followers: RelatedUser[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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

  const section = (title: string, empty: string, body: React.ReactNode) => (
    <section className="panel-arcane p-5">
      <h2 className="font-heading text-lg mb-3">{title}</h2>
      {body ?? <p className="text-sm text-ink-dim italic">{empty}</p>}
    </section>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
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
                <button
                  type="button"
                  className="btn-ghost text-xs px-3 py-1.5"
                  disabled={busy}
                  onClick={() =>
                    act(() => fetch(`/api/friends/${u.id}`, { method: "DELETE" }))
                  }
                >
                  Decline
                </button>
              </UserRow>
            ))}
          </ul>
        )}

      {section(
        `Friends (${friends.length})`,
        "No friends yet — find scribes on the browse page and send a request from their profile.",
        friends.length > 0 ? (
          <ul className="space-y-1">
            {friends.map((u) => (
              <UserRow key={u.id} u={u}>
                <button
                  type="button"
                  className="btn-ghost text-xs px-3 py-1.5"
                  disabled={busy}
                  onClick={() =>
                    act(() => fetch(`/api/friends/${u.id}`, { method: "DELETE" }))
                  }
                >
                  Remove
                </button>
              </UserRow>
            ))}
          </ul>
        ) : null
      )}

      {outgoing.length > 0 &&
        section(
          `Sent Requests (${outgoing.length})`,
          "",
          <ul className="space-y-1">
            {outgoing.map((u) => (
              <UserRow key={u.id} u={u}>
                <button
                  type="button"
                  className="btn-ghost text-xs px-3 py-1.5"
                  disabled={busy}
                  onClick={() =>
                    act(() => fetch(`/api/friends/${u.id}`, { method: "DELETE" }))
                  }
                >
                  Cancel
                </button>
              </UserRow>
            ))}
          </ul>
        )}

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
                    act(() => fetch(`/api/follow/${u.id}`, { method: "DELETE" }))
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
  );
}
