"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "./Avatar";
import { DashboardThemePicker } from "@/components/dashboard/DashboardThemePicker";

export interface NavUser {
  name: string;
  username: string | null;
  avatarImageId: string | null;
  dashboardTheme?: string;
}

const TABS = [
  { key: "library", label: "Library", href: "/dashboard" },
  { key: "browse", label: "Browse", href: "/browse" },
  { key: "saved", label: "Saved", href: "/saved" },
  { key: "friends", label: "Friends", href: "/friends" },
] as const;

export type NavTab = (typeof TABS)[number]["key"];

/** Top navigation for the signed-in app (and a slim variant when logged out). */
export function AppNav({
  user,
  active,
}: {
  user: NavUser | null;
  active?: NavTab;
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

  return (
    <nav className="sticky top-0 z-50 border-b border-void-border bg-void/85 backdrop-blur">
      <div className="max-w-6xl mx-auto flex items-center gap-3 sm:gap-5 px-4 sm:px-6 h-14">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.png" alt="" width={34} height={34} className="h-8.5 w-8.5" />
          <span className="font-display text-lg text-arcane-bright hidden md:inline">
            Arcadia Vellum
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2 min-w-0 overflow-x-auto">
          {(user ? TABS : TABS.filter((t) => t.key === "browse")).map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-heading whitespace-nowrap transition-colors ${
                active === t.key
                  ? "bg-arcane/15 text-arcane-bright"
                  : "text-ink-dim hover:text-ink hover:bg-white/5"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <div className="hidden sm:block">
                <DashboardThemePicker current={user.dashboardTheme || "witch-grimoire"} />
              </div>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  aria-label="Account menu"
                  aria-expanded={menuOpen}
                  className="flex items-center rounded-full hover:ring-2 hover:ring-arcane/50 transition"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <Avatar name={user.name} avatarImageId={user.avatarImageId} size={34} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 w-52 py-1 rounded-lg border border-void-border bg-void-raised shadow-xl shadow-black/50">
                    <div className="px-3 py-2 border-b border-void-border">
                      <p className="text-sm truncate">{user.name}</p>
                      {user.username && (
                        <p className="text-xs text-ink-dim truncate">@{user.username}</p>
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
      </div>
    </nav>
  );
}
