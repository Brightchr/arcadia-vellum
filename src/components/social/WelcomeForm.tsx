"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** First-login username onboarding (Google sign-ins land here). */
export function WelcomeForm({ suggestion }: { suggestion: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(suggestion);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(value: string) {
    if (!value) return;
    const res = await fetch(`/api/username-check?u=${encodeURIComponent(value)}`);
    const body = await res.json().catch(() => null);
    setNote(body?.available ? "Available ✓" : (body?.problem ?? "Unavailable"));
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Could not set the username.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm mb-1 text-ink-dim">
          Username
        </label>
        <input
          id="username"
          className="input-arcane"
          value={username}
          maxLength={30}
          autoFocus
          onChange={(e) => {
            setUsername(e.target.value.toLowerCase());
            setNote(null);
          }}
          onBlur={(e) => void check(e.target.value.trim().toLowerCase())}
        />
        <p className="text-xs text-ink-dim mt-1">
          {note ?? `Your profile will live at /u/${username || "..."}`}
        </p>
      </div>
      {error && (
        <p className="text-red-400 text-sm" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn-arcane w-full"
        disabled={busy || !username.trim()}
        onClick={confirm}
      >
        {busy ? "Claiming..." : "Claim Username"}
      </button>
    </div>
  );
}
