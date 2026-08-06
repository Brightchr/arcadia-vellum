"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Follow a series to get notified when new volumes are published. */
export function FollowSeriesButton({
  seriesId,
  following: initial,
  signedIn,
}: {
  seriesId: string;
  following: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await fetch(`/api/series-follow/${seriesId}`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) setFollowing(!next);
      else router.refresh();
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={following ? "btn-ghost" : "btn-arcane"}
      disabled={busy}
      title={
        following
          ? "Stop getting notified about new volumes"
          : "Get notified when new volumes are published"
      }
      onClick={toggle}
    >
      {following ? "Following Series" : "Follow Series"}
    </button>
  );
}
