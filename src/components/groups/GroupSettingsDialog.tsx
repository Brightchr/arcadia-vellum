"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/nav/Avatar";
import type { ChannelState, GroupRole, Rank } from "@/lib/groups";
import type { FriendPresence } from "@/lib/presence";
import type { RelatedUser } from "@/lib/social";
import { HashIcon, TrashIcon, XIcon } from "@/components/icons";
import { IconPicker } from "./IconPicker";

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  visibility: "public" | "private";
  welcomeMessage: string | null;
}

type Member = FriendPresence & { role: GroupRole; rankId: string | null };

export type SettingsTab =
  | "overview"
  | "channels"
  | "ranks"
  | "members"
  | "invites";
type Tab = SettingsTab;

/** Preset rank swatches (any hex works — these keep it one click). */
const SWATCHES = [
  "#0ab39c",
  "#299cdb",
  "#9d7bd8",
  "#d8a03c",
  "#e05c6a",
  "#7fb98f",
  "#f7b84b",
  "#8ea0d8",
];

async function api(path: string, init: RequestInit): Promise<string | null> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.ok) return null;
  const body = await res.json().catch(() => null);
  return body?.error ?? "That didn't work.";
}

/**
 * Discord-style group settings: identity + welcome message, channel
 * permissions and content gates, colored ranks, member assignments, and
 * invites. Mods see everything; members get the invite tab.
 */
export function GroupSettingsDialog({
  group,
  role,
  channels,
  ranks,
  members,
  invitable,
  initialTab,
  onClose,
}: {
  group: GroupInfo;
  role: GroupRole;
  channels: ChannelState[];
  ranks: Rank[];
  members: Member[];
  invitable: RelatedUser[];
  initialTab?: SettingsTab;
  onClose: () => void;
}) {
  const router = useRouter();
  const canMod = role === "owner" || role === "admin";
  const [tab, setTab] = useState<Tab>(
    initialTab ?? (canMod ? "overview" : "invites")
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Overview state
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [icon, setIcon] = useState(group.icon ?? "");
  const [visibility, setVisibility] = useState(group.visibility);
  const [welcome, setWelcome] = useState(group.welcomeMessage ?? "");

  // Ranks state
  const [rankName, setRankName] = useState("");
  const [rankColor, setRankColor] = useState(SWATCHES[0]);

  // Invites state
  const [invitee, setInvitee] = useState("");

  async function run(fn: () => Promise<string | null>, doneNote?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const err = await fn();
      if (err) setError(err);
      else {
        if (doneNote) setNotice(doneNote);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "overview", label: "Overview", show: canMod },
    { key: "channels", label: "Channels", show: canMod },
    { key: "ranks", label: "Ranks", show: canMod },
    { key: "members", label: "Members", show: canMod },
    { key: "invites", label: "Invites", show: true },
  ];

  const rankById = new Map(ranks.map((r) => [r.id, r]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${group.name} settings`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-arcane flex h-[min(40rem,90dvh)] w-full max-w-2xl flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-void-border px-5 py-3">
          <p className="font-heading text-base">
            {group.icon ? `${group.icon} ` : ""}
            {group.name} — Settings
          </p>
          <button
            type="button"
            aria-label="Close settings"
            className="rounded p-1.5 text-ink-dim hover:bg-overlay hover:text-ink"
            onClick={onClose}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-void-border px-3 py-2 overflow-x-auto overflow-y-hidden overscroll-x-contain">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-heading uppercase tracking-wider transition-colors ${
                  tab === t.key
                    ? "bg-arcane/15 text-arcane-bright"
                    : "text-ink-dim hover:bg-overlay hover:text-ink"
                }`}
                onClick={() => {
                  setTab(t.key);
                  setError(null);
                  setNotice(null);
                }}
              >
                {t.label}
              </button>
            ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4">
          {(error || notice) && (
            <p
              className={`text-xs ${error ? "text-red-400" : "text-emerald-400"}`}
              role="status"
            >
              {error ?? notice}
            </p>
          )}

          {/* ---------------- Overview ---------------- */}
          {tab === "overview" && canMod && (
            <>
              <div>
                <label
                  htmlFor="gs-name"
                  className="block text-xs text-ink-dim mb-1"
                >
                  Name
                </label>
                <input
                  id="gs-name"
                  className="input-arcane"
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <IconPicker value={icon} onChange={setIcon} />
              <div>
                <label
                  htmlFor="gs-desc"
                  className="block text-xs text-ink-dim mb-1"
                >
                  Description
                </label>
                <input
                  id="gs-desc"
                  className="input-arcane"
                  value={description}
                  maxLength={300}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="gs-visibility"
                  className="block text-xs text-ink-dim mb-1"
                >
                  Who can join
                </label>
                <select
                  id="gs-visibility"
                  className="input-arcane !w-auto"
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as "public" | "private")
                  }
                >
                  <option value="public">Anyone (public)</option>
                  <option value="private">Invite only</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="gs-welcome"
                  className="block text-xs text-ink-dim mb-1"
                >
                  Welcome message{" "}
                  <span className="opacity-60">
                    (shown at the top of the first channel)
                  </span>
                </label>
                <textarea
                  id="gs-welcome"
                  className="input-arcane min-h-20 resize-y"
                  placeholder="Welcome to the table! Session recaps live in #general…"
                  maxLength={500}
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-arcane"
                disabled={busy || !name.trim()}
                onClick={() =>
                  void run(
                    () =>
                      api(`/api/groups/${group.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          name,
                          description,
                          icon,
                          visibility,
                          welcomeMessage: welcome,
                        }),
                      }),
                    "Saved."
                  )
                }
              >
                {busy ? "Saving…" : "Save Overview"}
              </button>
            </>
          )}

          {/* ---------------- Channels ---------------- */}
          {tab === "channels" && canMod && (
            <div className="space-y-3">
              {channels.map((c) => (
                <ChannelSettingsRow
                  key={c.id}
                  groupId={group.id}
                  channel={c}
                  ranks={ranks}
                  busy={busy}
                  run={run}
                />
              ))}
              <p className="text-xs text-ink-dim">
                Add channels with the + next to “Channels” in the sidebar.
                “Ranks only” channels always stay open to the owner and admins.
              </p>
            </div>
          )}

          {/* ---------------- Ranks ---------------- */}
          {tab === "ranks" && canMod && (
            <>
              <div className="space-y-2">
                {ranks.length === 0 && (
                  <p className="text-sm text-ink-dim italic">
                    No ranks yet — create one below. Ranks color a member&apos;s
                    name and can unlock restricted channels.
                  </p>
                )}
                {ranks.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-lg border border-void-border px-3 py-2"
                  >
                    <span
                      aria-hidden
                      className="h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span
                      className="flex-1 truncate text-sm font-heading"
                      style={{ color: r.color }}
                    >
                      {r.name}
                    </span>
                    <span className="text-xs text-ink-dim">
                      {members.filter((m) => m.rankId === r.id).length} member
                      {members.filter((m) => m.rankId === r.id).length === 1
                        ? ""
                        : "s"}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost text-xs !px-2 !py-1"
                      disabled={busy}
                      onClick={() => {
                        const next = window.prompt("Rename rank:", r.name);
                        if (next === null) return;
                        void run(() =>
                          api(`/api/groups/${group.id}/ranks/${r.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ name: next }),
                          })
                        );
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete rank ${r.name}`}
                      className="p-1 text-ink-dim hover:text-red-400"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete the "${r.name}" rank?`))
                          return;
                        void run(() =>
                          api(`/api/groups/${group.id}/ranks/${r.id}`, {
                            method: "DELETE",
                          })
                        );
                      }}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-void-border p-3 space-y-2">
                <p className="text-xs font-heading uppercase tracking-wider text-ink-dim">
                  New Rank
                </p>
                <input
                  aria-label="Rank name"
                  className="input-arcane"
                  placeholder="Loremaster"
                  maxLength={24}
                  value={rankName}
                  onChange={(e) => setRankName(e.target.value)}
                />
                <div className="flex items-center gap-1.5">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      className={`h-6 w-6 rounded-full transition ${
                        rankColor === c
                          ? "ring-2 ring-ink ring-offset-2 ring-offset-void-raised"
                          : ""
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setRankColor(c)}
                    />
                  ))}
                  <input
                    aria-label="Custom color"
                    type="color"
                    className="ml-1 h-6 w-8 cursor-pointer rounded border border-void-border bg-transparent"
                    value={rankColor}
                    onChange={(e) => setRankColor(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-arcane text-xs px-3 py-1.5"
                  disabled={busy || !rankName.trim()}
                  onClick={() =>
                    void run(async () => {
                      const err = await api(`/api/groups/${group.id}/ranks`, {
                        method: "POST",
                        body: JSON.stringify({
                          name: rankName,
                          color: rankColor,
                        }),
                      });
                      if (!err) setRankName("");
                      return err;
                    })
                  }
                >
                  Create Rank
                </button>
              </div>
            </>
          )}

          {/* ---------------- Members ---------------- */}
          {tab === "members" && canMod && (
            <div className="space-y-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-overlay"
                >
                  <Avatar
                    name={m.name}
                    avatarImageId={m.avatarImageId}
                    size={30}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm"
                      style={
                        m.rankId && rankById.get(m.rankId)
                          ? { color: rankById.get(m.rankId)!.color }
                          : undefined
                      }
                    >
                      {m.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-ink-dim">
                      {m.role}
                    </span>
                  </span>
                  {m.role !== "owner" ? (
                    <select
                      aria-label={`Rank for ${m.name}`}
                      className="input-arcane !w-auto !px-2 !py-1 text-xs"
                      value={m.rankId ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        void run(() =>
                          api(`/api/groups/${group.id}/members/${m.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              rankId: e.target.value || null,
                            }),
                          })
                        )
                      }
                    >
                      <option value="">No rank</option>
                      {ranks.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-ink-dim">—</span>
                  )}
                </div>
              ))}
              <p className="pt-2 text-xs text-ink-dim">
                Kick, ban, and promote from the member list&apos;s options menu in
                the chat view.
              </p>
            </div>
          )}

          {/* ---------------- Invites ---------------- */}
          {tab === "invites" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-dim">
                Invite your friends — they get an alert and can join even if
                the group is private.
              </p>
              <div className="flex gap-2">
                <select
                  aria-label="Friend to invite"
                  className="input-arcane min-w-0 flex-1"
                  value={invitee}
                  onChange={(e) => setInvitee(e.target.value)}
                >
                  <option value="">Pick a friend…</option>
                  {invitable.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.username ? ` (@${f.username})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-arcane"
                  disabled={busy || !invitee}
                  onClick={() =>
                    void run(async () => {
                      const err = await api(`/api/groups/${group.id}/invite`, {
                        method: "POST",
                        body: JSON.stringify({ userId: invitee }),
                      });
                      if (!err) setInvitee("");
                      return err;
                    }, "Invite sent.")
                  }
                >
                  Invite
                </button>
              </div>
              {invitable.length === 0 && (
                <p className="text-xs text-ink-dim italic">
                  Everyone you&apos;re friends with is already here or invited.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One channel's settings block: NSFW gate + posting restrictions. */
function ChannelSettingsRow({
  groupId,
  channel,
  ranks,
  busy,
  run,
}: {
  groupId: string;
  channel: ChannelState;
  ranks: Rank[];
  busy: boolean;
  run: (fn: () => Promise<string | null>, note?: string) => Promise<void>;
}) {
  const [postMode, setPostMode] = useState(channel.postMode);
  const [postRanks, setPostRanks] = useState<string[]>(channel.postRanks);
  const [nsfw, setNsfw] = useState(channel.nsfw);
  const dirty =
    postMode !== channel.postMode ||
    nsfw !== channel.nsfw ||
    JSON.stringify([...postRanks].sort()) !==
      JSON.stringify([...channel.postRanks].sort());

  return (
    <div className="rounded-lg border border-void-border p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-heading">
        <HashIcon className="h-3.5 w-3.5 text-ink-dim" />
        {channel.name}
        {nsfw && (
          <span className="rounded bg-red-400/15 px-1 text-[9px] font-heading uppercase tracking-wider text-red-400">
            NSFW
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-dim">
          Who can post
          <select
            className="input-arcane !w-auto !px-2 !py-1 text-xs"
            value={postMode}
            disabled={busy}
            onChange={(e) =>
              setPostMode(e.target.value as ChannelState["postMode"])
            }
          >
            <option value="everyone">Everyone</option>
            <option value="mods">Owner & admins</option>
            <option value="ranks">Specific ranks</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-dim">
          <input
            type="checkbox"
            checked={nsfw}
            disabled={busy}
            onChange={(e) => setNsfw(e.target.checked)}
          />
          NSFW — readers confirm before viewing
        </label>
      </div>
      {postMode === "ranks" && (
        <div className="flex flex-wrap gap-1.5">
          {ranks.length === 0 && (
            <p className="text-xs text-ink-dim italic">
              Create ranks first (Ranks tab).
            </p>
          )}
          {ranks.map((r) => {
            const on = postRanks.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                className={`rounded-full border px-2 py-0.5 text-xs transition ${
                  on
                    ? "border-transparent"
                    : "border-void-border text-ink-dim hover:text-ink"
                }`}
                style={
                  on
                    ? {
                        backgroundColor: `${r.color}33`,
                        color: r.color,
                      }
                    : undefined
                }
                onClick={() =>
                  setPostRanks((prev) =>
                    on ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                  )
                }
              >
                {r.name}
              </button>
            );
          })}
        </div>
      )}
      {dirty && (
        <button
          type="button"
          className="btn-arcane text-xs px-3 py-1.5"
          disabled={busy}
          onClick={() =>
            void run(
              () =>
                fetch(`/api/groups/${groupId}/channels/${channel.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ postMode, postRanks, nsfw }),
                }).then(async (res) =>
                  res.ok
                    ? null
                    : ((await res.json().catch(() => null))?.error ??
                      "That didn't work.")
                ),
              "Channel updated."
            )
          }
        >
          Save #{channel.name}
        </button>
      )}
    </div>
  );
}
