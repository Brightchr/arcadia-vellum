"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "./Avatar";
import { NotificationsBell } from "./NotificationsBell";
import { DashboardThemePicker } from "@/components/dashboard/DashboardThemePicker";
import {
  BookOpenIcon,
  HeadphonesIcon,
  PenIcon,
  UsersIcon,
  CompassIcon,
  BookmarkIcon,
  LibraryIcon,
} from "@/components/icons";

export interface NavUser {
  name: string;
  username: string | null;
  avatarImageId: string | null;
  dashboardTheme?: string;
}

export interface SidebarPin {
  key: string;
  label: string;
  href: string;
  icon: string | null;
  /** "series" pins are the user's own collections; "saved" are saved works. */
  pinKind: "series" | "saved";
  /** For icon edits. */
  itemKind: "journal" | "series";
  itemId: string;
}

const NAV = [
  { key: "library", label: "Library", href: "/dashboard", icon: LibraryIcon },
  { key: "browse", label: "Browse", href: "/browse", icon: CompassIcon },
  { key: "saved", label: "Saved", href: "/saved", icon: BookmarkIcon },
  { key: "friends", label: "Friends", href: "/friends", icon: UsersIcon },
] as const;

export type NavTab = (typeof NAV)[number]["key"];

/**
 * The signed-in app frame: glassy left sidenav (nav + pinned shelves with
 * user-set icons) and a glassy topbar (notifications, theme, profile).
 * Logged-out pages get the topbar only.
 */
export function AppShell({
  user,
  active,
  pins = [],
  unreadNotifications = 0,
  children,
}: {
  user: NavUser | null;
  active?: NavTab;
  pins?: SidebarPin[];
  unreadNotifications?: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  async function setPinIcon(pin: SidebarPin) {
    const icon = window.prompt(
      "Pick an icon for this shelf (an emoji works best):",
      pin.icon ?? ""
    );
    if (icon === null) return;
    if (pin.pinKind === "series") {
      await fetch(`/api/series/${pin.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icon: icon.trim() || null }),
      });
    } else {
      await fetch("/api/saves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: pin.itemKind,
          itemId: pin.itemId,
          icon: icon.trim() || null,
        }),
      });
    }
    router.refresh();
  }

  const glass =
    "border-white/10 bg-white/[0.04] backdrop-blur-xl";

  return (
    <div className="flex min-h-dvh">
      {/* Sidenav (desktop, signed in) */}
      {user && (
        <aside
          className={`hidden md:flex w-60 shrink-0 flex-col border-r ${glass} sticky top-0 h-dvh`}
        >
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 h-14 shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.png" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="font-display text-lg text-arcane-bright">
              Arcadia Vellum
            </span>
          </Link>

          <nav className="px-2 space-y-0.5">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-heading transition-colors ${
                  active === item.key
                    ? "bg-arcane/15 text-arcane-bright"
                    : "text-ink-dim hover:text-ink hover:bg-white/5"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 px-4 flex items-center justify-between">
            <p className="text-[11px] font-heading uppercase tracking-widest text-ink-dim">
              Your Shelves
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-0.5">
            {pins.length === 0 ? (
              <p className="px-3 py-2 text-xs text-ink-dim italic">
                Collections and saved works appear here.
              </p>
            ) : (
              pins.map((pin) => (
                <div key={pin.key} className="group flex items-center">
                  <Link
                    href={pin.href}
                    className="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-ink-dim hover:text-ink hover:bg-white/5 transition-colors"
                  >
                    <span className="w-5 text-center shrink-0">
                      {pin.icon ??
                        (pin.pinKind === "series" ? (
                          <BookOpenIcon className="h-4 w-4 inline" />
                        ) : (
                          <HeadphonesIcon className="h-4 w-4 inline" />
                        ))}
                    </span>
                    <span className="truncate">{pin.label}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Set icon for ${pin.label}`}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-ink-dim hover:text-arcane-bright transition"
                    onClick={() => void setPinIcon(pin)}
                  >
                    <PenIcon className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-white/10">
            <Link href="/journal/new" className="btn-arcane w-full">
              + New Journal
            </Link>
          </div>
        </aside>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className={`sticky top-0 z-50 h-14 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 border-b ${glass}`}
        >
          {/* Mobile / logged-out branding + nav */}
          <Link
            href={user ? "/dashboard" : "/"}
            className={`flex items-center gap-2 shrink-0 ${user ? "md:hidden" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.png" alt="" width={30} height={30} className="h-7.5 w-7.5" />
            <span className="font-display text-base text-arcane-bright hidden sm:inline">
              Arcadia Vellum
            </span>
          </Link>
          <div
            className={`flex items-center gap-1 min-w-0 overflow-x-auto ${
              user ? "md:hidden" : ""
            }`}
          >
            {(user ? NAV : NAV.filter((t) => t.key === "browse")).map((t) => (
              <Link
                key={t.key}
                href={t.href}
                className={`px-2.5 py-1.5 rounded-md text-sm font-heading whitespace-nowrap transition-colors ${
                  active === t.key
                    ? "bg-arcane/15 text-arcane-bright"
                    : "text-ink-dim hover:text-ink hover:bg-white/5"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            {user ? (
              <>
                <div className="hidden sm:block">
                  <DashboardThemePicker
                    current={user.dashboardTheme || "witch-grimoire"}
                  />
                </div>
                <NotificationsBell initialUnread={unreadNotifications} />
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    aria-label="Account menu"
                    aria-expanded={menuOpen}
                    className="flex items-center rounded-full hover:ring-2 hover:ring-arcane/50 transition"
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <Avatar
                      name={user.name}
                      avatarImageId={user.avatarImageId}
                      size={32}
                    />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-full mt-2 z-50 w-52 py-1 rounded-lg border border-white/10 bg-void-raised/95 backdrop-blur-xl shadow-xl shadow-black/50">
                      <div className="px-3 py-2 border-b border-void-border">
                        <p className="text-sm truncate">{user.name}</p>
                        {user.username && (
                          <p className="text-xs text-ink-dim truncate">
                            @{user.username}
                          </p>
                        )}
                      </div>
                      {user.username && (
                        <Link
                          href={`/u/${user.username}`}
                          className="block px-3 py-2 text-sm hover:bg-arcane/10"
                          onClick={() => setMenuOpen(false)}
                        >
                          My Profile
                        </Link>
                      )}
                      <Link
                        href="/settings"
                        className="block px-3 py-2 text-sm hover:bg-arcane/10"
                        onClick={() => setMenuOpen(false)}
                      >
                        Settings
                      </Link>
                      <div className="my-1 border-t border-void-border" />
                      <button
                        type="button"
                        className="block w-full text-left px-3 py-2 text-sm hover:bg-arcane/10"
                        onClick={async () => {
                          await authClient.signOut();
                          router.push("/");
                          router.refresh();
                        }}
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost text-xs px-3 py-1.5">
                  Sign In
                </Link>
                <Link href="/signup" className="btn-arcane text-xs px-3 py-1.5">
                  Join Free
                </Link>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
