"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Avatar } from "@/components/nav/Avatar";

export interface ProfileSettings {
  name: string;
  username: string | null;
  bio: string | null;
  avatarImageId: string | null;
  profileVisibility: string;
  allowFriendRequests: boolean;
  showSavedOnProfile: boolean;
}

export function ProfileSettingsForm({ profile }: { profile: ProfileSettings }) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [usernameNote, setUsernameNote] = useState<string | null>(null);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [visibility, setVisibility] = useState(profile.profileVisibility);
  const [allowRequests, setAllowRequests] = useState(
    profile.allowFriendRequests
  );
  const [showSaved, setShowSaved] = useState(profile.showSavedOnProfile);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function checkUsername(value: string) {
    if (!value || value === profile.username) {
      setUsernameNote(null);
      return;
    }
    const res = await fetch(`/api/username-check?u=${encodeURIComponent(value)}`);
    const body = await res.json().catch(() => null);
    setUsernameNote(
      body?.available ? "Available ✓" : (body?.problem ?? "Unavailable")
    );
  }

  async function saveProfile() {
    setBusy("profile");
    setError(null);
    setNotice(null);
    try {
      if (name.trim() && name.trim() !== profile.name) {
        await authClient.updateUser({ name: name.trim() });
      }
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          bio,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Could not save the profile.");
      else {
        setNotice("Profile saved.");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function savePrivacy() {
    setBusy("privacy");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileVisibility: visibility,
          allowFriendRequests: allowRequests,
          showSavedOnProfile: showSaved,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Could not save privacy settings.");
      else {
        setNotice("Privacy settings saved.");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function uploadAvatar(f: File | null | undefined) {
    if (!f) return;
    setBusy("avatar");
    setError(null);
    try {
      const form = new FormData();
      form.set("file", f);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setError(body?.error ?? "Upload failed.");
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {(notice || error) && (
        <p
          className={`text-sm ${error ? "text-red-400" : "text-ember"}`}
          role="status"
        >
          {error ?? notice}
        </p>
      )}

      <section className="panel-arcane p-6 space-y-4">
        <h2 className="font-heading text-lg">Profile</h2>
        <div className="flex items-center gap-4">
          <Avatar
            name={profile.name}
            avatarImageId={profile.avatarImageId}
            size={64}
          />
          <div className="flex items-center gap-2">
            <label className="btn-ghost cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                disabled={busy !== null}
                onChange={(e) => {
                  void uploadAvatar(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {busy === "avatar" ? "Uploading..." : "Change Avatar"}
            </label>
            {profile.avatarImageId && (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy !== null}
                onClick={async () => {
                  await fetch("/api/profile/avatar", { method: "DELETE" });
                  router.refresh();
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="displayName" className="block text-sm mb-1 text-ink-dim">
            Display name
          </label>
          <input
            id="displayName"
            className="input-arcane"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="username" className="block text-sm mb-1 text-ink-dim">
            Username <span className="opacity-60">(your profile URL: /u/{username || "..."})</span>
          </label>
          <input
            id="username"
            className="input-arcane"
            value={username}
            maxLength={30}
            onChange={(e) => {
              setUsername(e.target.value.toLowerCase());
              setUsernameNote(null);
            }}
            onBlur={(e) => void checkUsername(e.target.value.trim().toLowerCase())}
          />
          {usernameNote && (
            <p className="text-xs text-ink-dim mt-1">{usernameNote}</p>
          )}
        </div>
        <div>
          <label htmlFor="bio" className="block text-sm mb-1 text-ink-dim">
            Bio <span className="opacity-60">(up to 500 characters)</span>
          </label>
          <textarea
            id="bio"
            className="input-arcane min-h-24 resize-y"
            value={bio}
            maxLength={500}
            placeholder="Chronicler of the Hollowmere campaign..."
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-arcane"
          disabled={busy !== null || !name.trim() || !username.trim()}
          onClick={saveProfile}
        >
          {busy === "profile" ? "Saving..." : "Save Profile"}
        </button>
      </section>

      <section className="panel-arcane p-6 space-y-4">
        <h2 className="font-heading text-lg">Privacy</h2>
        <div>
          <label
            htmlFor="visibility"
            className="block text-sm mb-1 text-ink-dim"
          >
            Who can see your profile page
          </label>
          <select
            id="visibility"
            className="input-arcane !w-auto"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="public">Everyone</option>
            <option value="friends">Friends only</option>
            <option value="private">Only me</option>
          </select>
          <p className="text-xs text-ink-dim mt-1">
            Public tomes stay discoverable on the browse page either way — this
            controls your profile, bio, and shelves.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowRequests}
            onChange={(e) => setAllowRequests(e.target.checked)}
          />
          Allow friend requests
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showSaved}
            onChange={(e) => setShowSaved(e.target.checked)}
          />
          Show my saved shelf on my profile
        </label>
        <button
          type="button"
          className="btn-arcane"
          disabled={busy !== null}
          onClick={savePrivacy}
        >
          {busy === "privacy" ? "Saving..." : "Save Privacy Settings"}
        </button>
      </section>
    </div>
  );
}
