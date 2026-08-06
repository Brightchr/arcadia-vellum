"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FriendState = "none" | "pending_out" | "pending_in" | "friends";

export function FollowFriendButtons({
  targetId,
  following: initialFollowing,
  friendState: initialFriendState,
  allowRequests,
  signedIn,
}: {
  targetId: string;
  following: boolean;
  friendState: FriendState;
  allowRequests: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [friendState, setFriendState] = useState(initialFriendState);
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<Response>, onOk: () => void) {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fn();
      if (res.ok) {
        onOk();
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const toggleFollow = () =>
    act(
      () => fetch(`/api/follow/${targetId}`, { method: following ? "DELETE" : "POST" }),
      () => setFollowing(!following)
    );

  const friendButton = () => {
    switch (friendState) {
      case "none":
        if (!allowRequests) return null;
        return (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() =>
              act(
                () => fetch(`/api/friends/${targetId}`, { method: "POST" }),
                () => setFriendState("pending_out")
              )
            }
          >
            Add Friend
          </button>
        );
      case "pending_out":
        return (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            title="Cancel your friend request"
            onClick={() =>
              act(
                () => fetch(`/api/friends/${targetId}`, { method: "DELETE" }),
                () => setFriendState("none")
              )
            }
          >
            Request Sent
          </button>
        );
      case "pending_in":
        return (
          <button
            type="button"
            className="btn-arcane"
            disabled={busy}
            onClick={() =>
              act(
                () => fetch(`/api/friends/${targetId}`, { method: "PATCH" }),
                () => setFriendState("friends")
              )
            }
          >
            Accept Friend Request
          </button>
        );
      case "friends":
        return (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            title="Remove friend"
            onClick={() =>
              act(
                () => fetch(`/api/friends/${targetId}`, { method: "DELETE" }),
                () => setFriendState("none")
              )
            }
          >
            ✓ Friends
          </button>
        );
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={following ? "btn-ghost" : "btn-arcane"}
        disabled={busy}
        onClick={toggleFollow}
      >
        {following ? "Following" : "Follow"}
      </button>
      {friendButton()}
    </div>
  );
}
