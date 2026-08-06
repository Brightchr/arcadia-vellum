"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";

interface NotificationItem {
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

function message(n: NotificationItem): string {
  const who = n.actorName ?? "Someone";
  switch (n.type) {
    case "friend_request":
      return `${who} sent you a friend request`;
    case "friend_accept":
      return `${who} accepted your friend request`;
    case "new_follower":
      return `${who} started following you`;
    case "review":
      return `${who} reviewed ${n.itemTitle ?? "your work"}`;
    case "new_volume":
      return `New volume in ${n.itemTitle ?? "a series you follow"}`;
    case "new_work":
      return `${who} published ${n.itemTitle ?? "a new work"}`;
    case "access_request":
      return `${who} requested access to ${n.itemTitle ?? "your work"}`;
    case "access_granted":
      return `${who} granted you access to ${n.itemTitle ?? "a work"}`;
    default:
      return "Something happened";
  }
}

function href(n: NotificationItem): string {
  if (n.type === "friend_request" || n.type === "friend_accept") {
    return "/friends";
  }
  if (n.type === "new_follower") {
    return n.actorUsername ? `/u/${n.actorUsername}` : "/friends";
  }
  return n.itemHref ?? "/browse";
}

/** Topbar bell: unread badge + dropdown; opening marks everything read. */
export function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const res = await fetch("/api/notifications");
        const body = await res.json();
        setItems(body.items ?? []);
        if ((body.unread ?? 0) > 0) {
          await fetch("/api/notifications", { method: "POST" });
        }
        setUnread(0);
      } catch {
        setItems([]);
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="relative rounded-md p-2 text-ink-dim hover:text-ink hover:bg-white/5 transition-colors"
        onClick={() => void toggle()}
      >
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-arcane-bright" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 max-w-[90vw] py-1 rounded-lg border border-white/10 bg-void-raised/95 backdrop-blur-xl shadow-xl shadow-black/50">
          <p className="px-3 py-2 font-heading text-sm border-b border-void-border">
            Notifications
          </p>
          {items === null ? (
            <p className="px-3 py-4 text-sm text-ink-dim">Loading...</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink-dim italic">
              All quiet in the archives.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={href(n)}
                    className={`flex items-start gap-2.5 px-3 py-2.5 hover:bg-arcane/10 transition-colors ${
                      n.read ? "opacity-70" : ""
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <Avatar
                      name={n.actorName ?? "?"}
                      avatarImageId={n.actorAvatarId}
                      size={30}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm leading-snug">
                        {message(n)}
                      </span>
                      <span className="block text-xs text-ink-dim mt-0.5">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
