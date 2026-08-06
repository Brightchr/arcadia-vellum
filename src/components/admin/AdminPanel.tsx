"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/nav/Avatar";
import { SearchIcon } from "@/components/icons";

export interface AdminUser {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatarImageId: string | null;
  role: "user" | "admin";
  banned: boolean;
  bannedAt: string | null;
  createdAt: string;
}

/** User moderation table: search all accounts, ban and unban. */
export function AdminPanel({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/users?q=${encodeURIComponent(q.trim())}`
        );
        const body = await res.json().catch(() => null);
        if (Array.isArray(body?.users)) setUsers(body.users);
      } catch {
        // keep the current list
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  async function setBanned(u: AdminUser, banned: boolean) {
    const verb = banned ? "Ban" : "Unban";
    if (
      !window.confirm(
        banned
          ? `${verb} ${u.name}${u.username ? ` (@${u.username})` : ""}? Their works, reviews, and profile will be hidden, and everyone who saved their work will be notified.`
          : `${verb} ${u.name}? Their works, reviews, and profile become visible again.`
      )
    ) {
      return;
    }
    setBusyId(u.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, banned }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "That didn't work.");
        return;
      }
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? { ...x, banned, bannedAt: banned ? new Date().toISOString() : null }
            : x
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <label className="relative block max-w-md">
        <SearchIcon className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-dim" />
        <input
          value={q}
          placeholder="Search by name, username, or email..."
          aria-label="Search users"
          className="input-arcane !pl-10"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      <div className="panel-arcane overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-heading uppercase tracking-wider text-ink-dim border-b border-void-border">
              <th className="px-4 py-3">Scribe</th>
              <th className="px-4 py-3 hidden md:table-cell">Email</th>
              <th className="px-4 py-3 hidden sm:table-cell">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-dim italic">
                  No accounts match.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-b border-void-border/50 last:border-0 ${
                    u.banned ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={u.name}
                        avatarImageId={u.avatarImageId}
                        size={30}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-heading">
                          {u.name}
                          {u.role === "admin" && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-arcane/20 border border-arcane/50 px-1.5 py-0.5 text-[9px] font-heading uppercase tracking-widest text-arcane-bright">
                              Admin
                            </span>
                          )}
                        </span>
                        {u.username && (
                          <Link
                            href={`/u/${u.username}`}
                            className="block text-xs text-ink-dim truncate hover:text-arcane-bright"
                          >
                            @{u.username}
                          </Link>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-ink-dim truncate max-w-48">
                    {u.email}
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-ink-dim whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.banned ? (
                      <span
                        className="inline-flex items-center rounded-full bg-red-500/15 border border-red-500/40 px-2 py-0.5 text-[10px] font-heading uppercase tracking-widest text-red-400"
                        title={
                          u.bannedAt
                            ? `Banned ${new Date(u.bannedAt).toLocaleString()}`
                            : "Banned"
                        }
                      >
                        Banned
                      </span>
                    ) : (
                      <span className="text-xs text-ink-dim">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="btn-ghost !px-3 !py-1 text-xs mr-1.5"
                    >
                      Inspect
                    </Link>
                    {u.role !== "admin" &&
                      (u.banned ? (
                        <button
                          type="button"
                          className="btn-ghost !px-3 !py-1 text-xs"
                          disabled={busyId !== null}
                          onClick={() => void setBanned(u, false)}
                        >
                          {busyId === u.id ? "..." : "Unban"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-ghost !px-3 !py-1 text-xs !border-red-500/40 hover:!border-red-400 text-red-400"
                          disabled={busyId !== null}
                          onClick={() => void setBanned(u, true)}
                        >
                          {busyId === u.id ? "..." : "Ban"}
                        </button>
                      ))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
