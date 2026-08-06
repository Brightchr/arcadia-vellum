"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/nav/Avatar";
import { SearchIcon } from "@/components/icons";

interface FoundUser {
  name: string;
  username: string;
  avatarImageId: string | null;
  bio: string | null;
}

/**
 * Discord-style people lookup: type an @username or a display name and jump
 * to their profile. Results come from /api/users/search (debounced).
 */
export function UserSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoundUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.replace(/^@/, "").length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}`
        );
        const body = await res.json().catch(() => null);
        setResults(Array.isArray(body?.users) ? body.users : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <SearchIcon className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-dim" />
        <input
          value={q}
          placeholder="Find scribes by @username or name..."
          aria-label="Find users"
          className="input-arcane !pl-10"
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      {searching && (
        <p className="text-xs text-ink-dim px-1" role="status">
          Searching...
        </p>
      )}

      {!searching && results !== null && results.length === 0 && (
        <p className="text-sm text-ink-dim italic px-1">
          No scribes match &ldquo;{q.trim()}&rdquo;.
        </p>
      )}

      {!searching && results !== null && results.length > 0 && (
        <ul className="space-y-1">
          {results.map((u) => (
            <li key={u.username}>
              <Link
                href={`/u/${u.username}`}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
              >
                <Avatar name={u.name} avatarImageId={u.avatarImageId} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-heading text-arcane-bright truncate">
                    {u.name}
                  </span>
                  <span className="block text-xs text-ink-dim truncate">
                    @{u.username}
                    {u.bio ? ` — ${u.bio}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
