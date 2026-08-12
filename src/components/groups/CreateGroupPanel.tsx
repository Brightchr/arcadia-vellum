"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Create Group" button + inline dialog form. */
export function CreateGroupPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          icon: icon || undefined,
          visibility,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Could not create the group.");
        return;
      }
      router.push(`/groups/${body.group.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-arcane"
        onClick={() => setOpen((v) => !v)}
      >
        + Create Group
      </button>
      {open && (
        <div className="app-menu absolute right-0 top-full mt-2 z-50 w-80 max-w-[90vw] rounded-lg p-4 shadow-xl shadow-black/30 space-y-3">
          <div>
            <label htmlFor="group-name" className="block text-xs text-ink-dim mb-1">
              Name
            </label>
            <input
              id="group-name"
              className="input-arcane"
              value={name}
              maxLength={60}
              placeholder="The Hollowmere Table"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="group-desc"
              className="block text-xs text-ink-dim mb-1"
            >
              Description <span className="opacity-60">(optional)</span>
            </label>
            <input
              id="group-desc"
              className="input-arcane"
              value={description}
              maxLength={300}
              placeholder="What's this circle about?"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <div className="w-20">
              <label
                htmlFor="group-icon"
                className="block text-xs text-ink-dim mb-1"
              >
                Icon
              </label>
              <input
                id="group-icon"
                className="input-arcane text-center"
                value={icon}
                maxLength={4}
                placeholder="🐉"
                onChange={(e) => setIcon(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="group-visibility"
                className="block text-xs text-ink-dim mb-1"
              >
                Who can join
              </label>
              <select
                id="group-visibility"
                className="input-arcane"
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "public" | "private")
                }
              >
                <option value="public">Anyone (public)</option>
                <option value="private">Invite only</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost text-xs px-3 py-1.5"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-arcane text-xs px-3 py-1.5"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              {busy ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
