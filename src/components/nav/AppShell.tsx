"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "./Avatar";
import { NotificationsBell } from "./NotificationsBell";
import { DashboardThemePicker } from "@/components/dashboard/DashboardThemePicker";
import { Breadcrumbs } from "./Breadcrumbs";
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
  /** Shows the Admin Dashboard link in the account menu. */
  isAdmin?: boolean;
}

export interface SidebarPin {
  key: string;
  label: string;
  href: string;
  icon: string | null;
  /** Rounded cover art for the pin (Spotify-style), when the work has one. */
  imageUrl?: string | null;
  /** Own collections, saved works, or the user's playlists. */
  pinKind: "series" | "saved" | "playlist";
  /** For icon edits. */
  itemKind: "journal" | "series";
  itemId: string;
}

const NAV = [
  { key: "library", label: "Home", href: "/dashboard", icon: LibraryIcon },
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
  const [collapsed, setCollapsed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The visual layout is CSS-driven via html[data-nav-collapsed] (set by
    // the pre-paint script), so it never flashes on load or remount. This
    // state only keeps the toggle button's aria-label/title accurate, and
    // re-applies the attribute in case hydration stripped it.
    let stored = false;
    try {
      stored = localStorage.getItem("av-nav-collapsed") === "1";
    } catch {
      // Storage blocked — leave expanded.
    }
    setCollapsed(stored);
    if (stored) document.documentElement.dataset.navCollapsed = "1";
    else delete document.documentElement.dataset.navCollapsed;
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("av-nav-collapsed", next ? "1" : "0");
      } catch {
        // Storage blocked — the toggle still works for this page.
      }
      if (next) document.documentElement.dataset.navCollapsed = "1";
      else delete document.documentElement.dataset.navCollapsed;
      return next;
    });
  }

  async function createPlaylist() {
    const name = window.prompt(
      "Name your playlist (e.g. Hollowmere, in order):"
    )?.trim();
    if (!name) return;
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      window.alert(body?.error ?? "Could not create the playlist.");
      return;
    }
    router.push(`/playlists/${body.playlist.id}`);
    router.refresh();
  }

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
    } else if (pin.pinKind === "playlist") {
      await fetch(`/api/playlists/${pin.itemId}`, {
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

  function pinArt(pin: SidebarPin) {
    const cls = "h-8 w-8 navc:h-9 navc:w-9 rounded-md object-cover shrink-0";
    if (pin.imageUrl) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={pin.imageUrl} alt="" className={cls} />;
    }
    return (
      <span
        className={`${cls} inline-flex items-center justify-center bg-white/5 text-base`}
        aria-hidden
      >
        {pin.icon ??
          (pin.pinKind === "playlist" ? (
            <HeadphonesIcon className="h-4 w-4 text-ink-dim" />
          ) : (
            <BookOpenIcon className="h-4 w-4 text-ink-dim" />
          ))}
      </span>
    );
  }

  const glass =
    "border-white/10 bg-white/[0.04] backdrop-blur-xl";

  return (
    <div className="flex min-h-dvh">
      {/* Sidenav (desktop, signed in) — collapses to a Spotify-style rail */}
      {user && (
        <aside
          className={`app-sidenav hidden md:flex shrink-0 flex-col overflow-hidden border-r ${glass} sticky top-0 h-dvh transition-[width] duration-200`}
        >
          <div className="flex items-center h-14 shrink-0 justify-between pr-2 navc:justify-center navc:pr-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-4 navc:hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/mark.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="flex flex-col">
                <span className="font-display text-lg leading-tight text-arcane-bright">
                  Vellum
                </span>
                <span className="text-[10px] leading-none uppercase tracking-[0.2em] text-ink-dim">
                  by Arcadia
                </span>
              </span>
            </Link>
            <button
              type="button"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              title={collapsed ? "Expand" : "Collapse"}
              className="p-2 rounded-md text-ink-dim hover:text-ink hover:bg-white/5 transition-colors"
              onClick={toggleCollapsed}
            >
              <svg
                viewBox="0 0 24 24"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="navc:rotate-180"
              >
                <path d="m15 18-6-6 6-6" />
                <path d="M3 12h.01" />
              </svg>
            </button>
          </div>

          <nav className="px-2 space-y-0.5">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 px-3 navc:justify-center navc:px-0 py-2 rounded-md text-sm font-heading transition-colors ${
                  active === item.key
                    ? "bg-arcane/15 text-arcane-bright"
                    : "text-ink-dim hover:text-ink hover:bg-white/5"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="navc:hidden">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-4 flex items-center justify-between px-4 navc:justify-center navc:px-0">
            <p className="navc:hidden text-[11px] font-heading uppercase tracking-widest text-ink-dim">
              Your Shelves
            </p>
            <button
              type="button"
              aria-label="New playlist"
              title="New playlist — arrange audiobooks in your own order"
              className="p-1 rounded-md text-ink-dim hover:text-arcane-bright hover:bg-white/5 transition-colors text-base leading-none"
              onClick={() => void createPlaylist()}
            >
              +
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-0.5">
            {pins.length === 0 ? (
              <p className="navc:hidden px-3 py-2 text-xs text-ink-dim italic">
                Collections, saved works, and playlists appear here.
              </p>
            ) : (
              pins.map((pin) => (
                <div
                  key={pin.key}
                  className="group flex items-center navc:justify-center"
                >
                  <Link
                    href={pin.href}
                    title={pin.label}
                    className="min-w-0 flex items-center rounded-md text-sm text-ink-dim hover:text-ink hover:bg-white/5 transition-colors flex-1 gap-2.5 px-2 py-1.5 navc:flex-none navc:px-1.5"
                  >
                    {pinArt(pin)}
                    <span className="truncate navc:hidden">{pin.label}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Set icon for ${pin.label}`}
                    className="navc:hidden opacity-0 group-hover:opacity-100 p-1.5 text-ink-dim hover:text-arcane-bright transition"
                    onClick={() => void setPinIcon(pin)}
                  >
                    <PenIcon className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-3 navc:p-2 border-t border-white/10">
            <Link
              href="/journal/new"
              title="New Journal"
              className="btn-arcane w-full navc:px-0!"
            >
              +<span className="navc:hidden">&nbsp;New Journal</span>
            </Link>
          </div>
        </aside>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className={`sticky top-0 z-50 h-14 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 border-b ${glass}`}
        >
          {/* Breadcrumb trail — pages like Settings stay one click from Home */}
          <Breadcrumbs signedIn={!!user} />

          {/* Mobile / logged-out branding + nav */}
          <Link
            href={user ? "/dashboard" : "/"}
            className={`flex items-center gap-2 shrink-0 ${user ? "md:hidden" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.png" alt="" width={30} height={30} className="h-7.5 w-7.5" />
            <span className="font-display text-base text-arcane-bright hidden sm:inline">
              Vellum
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
                      {user.isAdmin && (
                        <Link
                          href="/admin"
                          className="block px-3 py-2 text-sm text-arcane-bright hover:bg-arcane/10"
                          onClick={() => setMenuOpen(false)}
                        >
                          Admin Dashboard
                        </Link>
                      )}
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
