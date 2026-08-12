"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/nav/Avatar";
import type {
  ChannelState,
  GroupMessage,
  GroupRole,
  MessageFlag,
  Rank,
  WorkEmbed,
} from "@/lib/groups";
import { REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";
import { GroupSettingsDialog } from "./GroupSettingsDialog";
import type { FriendPresence } from "@/lib/presence";
import type { RelatedUser } from "@/lib/social";
import {
  BookOpenIcon,
  ChevronLeftIcon,
  HashIcon,
  LockIcon,
  SendIcon,
  UsersIcon,
} from "@/components/icons";

const POLL_MS = 5000;

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  visibility: "public" | "private";
  welcomeMessage: string | null;
}

type Member = FriendPresence & { role: GroupRole; rankId: string | null };

/** Who may act on whom (mirrors the server rules). */
function canActOn(actor: GroupRole, target: GroupRole): boolean {
  if (target === "owner") return false;
  if (actor === "owner") return true;
  return actor === "admin" && target === "member";
}

function timeLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString()} ${time}`;
}

function readAckList(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("av-nsfw-ack") ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** A shared work rendered as a compact card under the message. */
function EmbedCard({ embed }: { embed: WorkEmbed }) {
  return (
    <Link
      href={embed.href}
      className="mt-1.5 flex w-fit max-w-full items-center gap-3 rounded-lg border border-edge bg-overlay p-2 pr-4 transition-colors hover:border-arcane/60"
    >
      {embed.coverImageId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/images/${embed.coverImageId}`}
          alt=""
          className="h-14 w-10 rounded object-cover"
        />
      ) : (
        <span className="flex h-14 w-10 items-center justify-center rounded bg-overlay-strong">
          <BookOpenIcon className="h-4 w-4 text-ink-dim" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-heading text-arcane-bright">
          {embed.title}
        </span>
        <span className="block text-xs text-ink-dim">
          {embed.author ?? (embed.kind === "series" ? "Series" : "Book")}
        </span>
      </span>
    </Link>
  );
}

/** Message body; spoiler/NSFW-flagged content hides until clicked. */
function MessageBody({ m }: { m: GroupMessage }) {
  const [revealed, setRevealed] = useState(false);
  if (m.flag && !revealed) {
    const nsfw = m.flag === "nsfw";
    return (
      <button
        type="button"
        className={`mt-0.5 rounded-md border px-3 py-1.5 text-xs font-heading uppercase tracking-wider transition-colors ${
          nsfw
            ? "border-red-400/40 text-red-400 hover:bg-red-400/10"
            : "border-edge text-ink-dim hover:bg-overlay"
        }`}
        onClick={() => setRevealed(true)}
      >
        {nsfw ? "NSFW" : "Spoiler"} — click to reveal
      </button>
    );
  }
  return (
    <>
      <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
      {m.embeds.map((e) => (
        <EmbedCard key={`${e.kind}:${e.slug}`} embed={e} />
      ))}
    </>
  );
}

function MessageRow({
  m,
  compact,
  nameColor,
}: {
  m: GroupMessage;
  compact: boolean;
  nameColor?: string;
}) {
  if (compact) {
    return (
      <div className="group flex gap-3 px-3 py-0.5 hover:bg-overlay rounded-md">
        <span className="w-9 shrink-0 select-none text-right text-[10px] leading-6 text-ink-dim opacity-0 group-hover:opacity-100">
          {new Date(m.createdAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <div className="min-w-0 flex-1">
          <MessageBody m={m} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 px-3 pt-3 pb-0.5 hover:bg-overlay rounded-md">
      <span className="shrink-0 pt-0.5">
        <Avatar name={m.authorName} avatarImageId={m.authorAvatarId} size={34} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          {m.authorUsername ? (
            <Link
              href={`/u/${m.authorUsername}`}
              className="text-sm font-heading hover:underline"
              style={{ color: nameColor ?? "var(--arcane-bright)" }}
            >
              {m.authorName}
            </Link>
          ) : (
            <span
              className="text-sm font-heading"
              style={nameColor ? { color: nameColor } : undefined}
            >
              {m.authorName}
            </span>
          )}
          <span className="text-[10px] text-ink-dim">
            {timeLabel(m.createdAt)}
          </span>
        </p>
        <MessageBody m={m} />
      </div>
    </div>
  );
}

function MemberRow({
  m,
  myRole,
  isMe,
  rankById,
  onModerate,
}: {
  m: Member;
  myRole: GroupRole;
  isMe: boolean;
  rankById: Map<string, Rank>;
  onModerate?: (m: Member) => void;
}) {
  const moderatable = !isMe && !!onModerate && canActOn(myRole, m.role);
  const rank = m.rankId ? rankById.get(m.rankId) : undefined;
  return (
    <li className="group/member flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-overlay">
      <span className="relative inline-flex shrink-0">
        <Avatar name={m.name} avatarImageId={m.avatarImageId} size={30} />
        <span
          aria-hidden
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-void-raised ${
            m.online ? "bg-emerald-400" : "bg-ink-dim/50"
          }`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm">
          {m.username ? (
            <Link
              href={`/u/${m.username}`}
              className="truncate hover:underline"
              style={rank ? { color: rank.color } : undefined}
            >
              {m.name}
            </Link>
          ) : (
            <span
              className="truncate"
              style={rank ? { color: rank.color } : undefined}
            >
              {m.name}
            </span>
          )}
          {m.role === "owner" && (
            <span className="shrink-0 rounded bg-ember/20 px-1 text-[9px] font-heading uppercase tracking-wider text-ember">
              Owner
            </span>
          )}
          {m.role === "admin" && (
            <span className="shrink-0 rounded bg-arcane/20 px-1 text-[9px] font-heading uppercase tracking-wider text-arcane-bright">
              Admin
            </span>
          )}
        </span>
        {rank && (
          <span
            className="block truncate text-[10px] font-heading uppercase tracking-wider"
            style={{ color: rank.color }}
          >
            {rank.name}
          </span>
        )}
        {m.online && m.activityLabel && (
          <span className="block truncate text-[11px] text-emerald-400">
            {m.activityLabel}
          </span>
        )}
      </span>
      {moderatable && (
        <button
          type="button"
          aria-label={`Moderate ${m.name}`}
          title="Manage member"
          className="shrink-0 rounded p-1 text-ink-dim opacity-0 transition group-hover/member:opacity-100 hover:text-ink hover:bg-overlay-strong"
          onClick={() => onModerate(m)}
        >
          ⋯
        </button>
      )}
    </li>
  );
}

/** Kick / promote / ban dialog for one member, with the report escalation. */
function ModerateDialog({
  m,
  groupId,
  myRole,
  onClose,
  onDone,
}: {
  m: Member;
  groupId: string;
  myRole: GroupRole;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "ban">("menu");
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${m.id}`, init);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "That didn't work.");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function kick() {
    if (await call({ method: "DELETE" })) onDone();
  }

  async function setRole(role: "admin" | "member") {
    const ok = await call({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (ok) onDone();
  }

  async function ban() {
    const ok = await call({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ban",
        report: report
          ? { reason, details: details.trim() || undefined }
          : undefined,
      }),
    });
    if (ok) onDone();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Moderate ${m.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-arcane w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar name={m.name} avatarImageId={m.avatarImageId} size={36} />
          <div className="min-w-0">
            <p className="truncate font-heading text-sm">{m.name}</p>
            {m.username && (
              <p className="truncate text-xs text-ink-dim">@{m.username}</p>
            )}
          </div>
        </div>

        {mode === "menu" ? (
          <div className="space-y-2">
            {myRole === "owner" &&
              (m.role === "member" ? (
                <button
                  type="button"
                  className="btn-ghost w-full"
                  disabled={busy}
                  onClick={() => void setRole("admin")}
                >
                  Promote to Admin
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-ghost w-full"
                  disabled={busy}
                  onClick={() => void setRole("member")}
                >
                  Demote to Member
                </button>
              ))}
            <button
              type="button"
              className="btn-ghost w-full"
              disabled={busy}
              onClick={() => void kick()}
            >
              Kick from Group
            </button>
            <button
              type="button"
              className="btn-ghost w-full !border-red-400/40 !text-red-400 hover:!bg-red-400/10"
              disabled={busy}
              onClick={() => setMode("ban")}
            >
              Ban from Group…
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-dim">
              {m.name} will be removed and can&apos;t rejoin or be re-invited.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={report}
                onChange={(e) => setReport(e.target.checked)}
              />
              <span>
                Also report to Vellum moderators
                <span className="block text-xs text-ink-dim">
                  They&apos;ll be muted platform-wide (no chats, no reviews)
                  while the report is reviewed.
                </span>
              </span>
            </label>
            {report && (
              <>
                <select
                  aria-label="Report reason"
                  className="input-arcane"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReportReason)}
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <textarea
                  aria-label="Report details"
                  className="input-arcane min-h-20 resize-y"
                  placeholder="What happened? (optional, shown to moderators)"
                  maxLength={500}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn-ghost text-xs px-3 py-1.5"
            onClick={mode === "ban" ? () => setMode("menu") : onClose}
          >
            {mode === "ban" ? "Back" : "Close"}
          </button>
          {mode === "ban" && (
            <button
              type="button"
              className="btn-arcane text-xs px-3 py-1.5"
              disabled={busy}
              onClick={() => void ban()}
            >
              {busy ? "Banning…" : report ? "Ban & Report" : "Ban"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function GroupView({
  group,
  role,
  meId,
  channels: initialChannels,
  members,
  ranks,
  invitable,
  groupMuted: initialGroupMuted,
}: {
  group: GroupInfo;
  role: GroupRole;
  meId: string;
  channels: ChannelState[];
  members: Member[];
  ranks: Rank[];
  invitable: RelatedUser[];
  groupMuted: boolean;
}) {
  const router = useRouter();
  const canMod = role === "owner" || role === "admin";
  const [moderating, setModerating] = useState<Member | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [channels, setChannels] = useState(initialChannels);
  const [channelId, setChannelId] = useState(initialChannels[0]?.id ?? null);
  const [messages, setMessages] = useState<GroupMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [flag, setFlag] = useState<MessageFlag | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupMuted, setGroupMuted] = useState(initialGroupMuted);
  // Layout: collapsible channel rail + member panel (persisted per device).
  const [chanCollapsed, setChanCollapsed] = useState(false);
  const [membersOpen, setMembersOpen] = useState(true);
  const [showMembersMobile, setShowMembersMobile] = useState(false);
  const [nsfwAck, setNsfwAck] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  // Keep local channel state in sync when the server refreshes props.
  useEffect(() => {
    setChannels(initialChannels);
    setChannelId((cur) =>
      cur && initialChannels.some((c) => c.id === cur)
        ? cur
        : (initialChannels[0]?.id ?? null)
    );
  }, [initialChannels]);
  useEffect(() => setGroupMuted(initialGroupMuted), [initialGroupMuted]);

  useEffect(() => {
    try {
      setChanCollapsed(localStorage.getItem("av-chan-collapsed") === "1");
      setMembersOpen(localStorage.getItem("av-members-open") !== "0");
      setNsfwAck(readAckList());
    } catch {
      // Storage blocked — defaults stand.
    }
  }, []);

  const channel = channels.find((c) => c.id === channelId) ?? null;
  const nsfwGated = !!channel?.nsfw && !nsfwAck.includes(channel.id);
  const rankById = new Map(ranks.map((r) => [r.id, r]));
  const me = members.find((m) => m.id === meId);
  const myRankId = me?.rankId ?? null;
  const canPostHere =
    !!channel &&
    (canMod ||
      channel.postMode === "everyone" ||
      (channel.postMode === "ranks" &&
        !!myRankId &&
        channel.postRanks.includes(myRankId)));

  const online = members.filter((m) => m.online);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Initial load + polling for the selected channel (paused behind NSFW gate).
  useEffect(() => {
    if (!channelId || nsfwGated) return;
    let cancelled = false;
    lastIdRef.current = null;
    setMessages(null);
    // Opening the channel clears its unread dot.
    setChannels((prev) =>
      prev.map((c) => (c.id === channelId ? { ...c, unread: false } : c))
    );

    async function load(initial: boolean) {
      const after = lastIdRef.current;
      const url = `/api/groups/${group.id}/channels/${channelId}/messages${
        after ? `?after=${encodeURIComponent(after)}` : ""
      }`;
      try {
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const body = await res.json();
        const incoming: GroupMessage[] = body.messages ?? [];
        if (cancelled) return;
        if (initial) {
          setMessages(incoming);
        } else if (incoming.length > 0) {
          setMessages((prev) => {
            const seen = new Set((prev ?? []).map((m) => m.id));
            return [...(prev ?? []), ...incoming.filter((m) => !seen.has(m.id))];
          });
        }
        if (incoming.length > 0) {
          lastIdRef.current = incoming[incoming.length - 1].id;
        }
      } catch {
        // Poll again next tick.
      }
    }

    void load(true);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [channelId, group.id, nsfwGated]);

  // Stick to the bottom as messages arrive.
  const count = messages?.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom || count <= 50) scrollToBottom();
  }, [count, scrollToBottom]);

  function toggleChanCollapsed() {
    setChanCollapsed((v) => {
      try {
        localStorage.setItem("av-chan-collapsed", v ? "0" : "1");
      } catch {
        // Fine — just not persisted.
      }
      return !v;
    });
  }

  function toggleMembersOpen() {
    setMembersOpen((v) => {
      try {
        localStorage.setItem("av-members-open", v ? "0" : "1");
      } catch {
        // Fine — just not persisted.
      }
      return !v;
    });
  }

  function ackNsfw(id: string) {
    setNsfwAck((prev) => {
      const next = [...new Set([...prev, id])];
      try {
        localStorage.setItem("av-nsfw-ack", JSON.stringify(next));
      } catch {
        // Session-only acknowledgement.
      }
      return next;
    });
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy || !channelId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/groups/${group.id}/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text, flag: flag ?? undefined }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Could not send.");
        return;
      }
      setDraft("");
      setFlag(null);
      const m: GroupMessage = body.message;
      setMessages((prev) => [...(prev ?? []), m]);
      lastIdRef.current = m.id;
      requestAnimationFrame(scrollToBottom);
    } finally {
      setBusy(false);
    }
  }

  async function addChannel() {
    const name = window.prompt("Channel name (e.g. session-recaps):")?.trim();
    if (!name) return;
    const res = await fetch(`/api/groups/${group.id}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      window.alert(body?.error ?? "Could not create the channel.");
      return;
    }
    setChannels((prev) => [
      ...prev,
      { ...body.channel, muted: false, unread: false },
    ]);
    setChannelId(body.channel.id);
  }

  async function removeChannel(c: ChannelState) {
    if (!window.confirm(`Delete #${c.name} and all its messages?`)) return;
    const res = await fetch(`/api/groups/${group.id}/channels/${c.id}`, {
      method: "DELETE",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      window.alert(body?.error ?? "Could not delete the channel.");
      return;
    }
    setChannels((prev) => {
      const next = prev.filter((x) => x.id !== c.id);
      if (channelId === c.id) setChannelId(next[0]?.id ?? null);
      return next;
    });
  }

  async function toggleChannelMute(c: ChannelState) {
    setChannels((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, muted: !c.muted } : x))
    );
    await fetch(`/api/groups/${group.id}/channels/${c.id}/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted: !c.muted }),
    }).catch(() => {});
  }

  async function toggleGroupMute() {
    const next = !groupMuted;
    setGroupMuted(next);
    await fetch(`/api/groups/${group.id}/mute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted: next }),
    }).catch(() => {});
  }

  async function leaveOrDelete() {
    if (role === "owner") {
      if (
        !window.confirm(
          `Delete "${group.name}" for everyone? This removes all channels and messages.`
        )
      )
        return;
      await fetch(`/api/groups/${group.id}`, { method: "DELETE" });
    } else {
      if (!window.confirm(`Leave "${group.name}"?`)) return;
      await fetch(`/api/groups/${group.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      });
    }
    router.push("/groups");
    router.refresh();
  }

  const channelName = channel?.name ?? "channel";
  const flagLabel =
    flag === "spoiler" ? "Spoiler" : flag === "nsfw" ? "NSFW" : "No flag";

  const memberList = (
    <>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {online.map((m) => (
          <MemberRow
            key={m.id}
            m={m}
            myRole={role}
            isMe={m.id === meId}
            rankById={rankById}
            onModerate={canMod ? setModerating : undefined}
          />
        ))}
        {members.filter((m) => !m.online).length > 0 && (
          <li className="px-2 pt-2 pb-1 text-[10px] font-heading uppercase tracking-widest text-ink-dim/70">
            Offline
          </li>
        )}
        {members
          .filter((m) => !m.online)
          .map((m) => (
            <MemberRow
              key={m.id}
              m={m}
              myRole={role}
              isMe={m.id === meId}
              rankById={rankById}
              onModerate={canMod ? setModerating : undefined}
            />
          ))}
      </ul>
    </>
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0">
      {/* Channel rail — collapses to an icon strip */}
      <aside
        style={{ width: chanCollapsed ? "3.75rem" : "14rem" }}
        className="hidden md:flex shrink-0 flex-col border-r border-edge bg-overlay transition-[width] duration-200 overflow-hidden"
      >
        <div
          className={`flex items-center border-b border-edge p-2 ${
            chanCollapsed ? "justify-center" : "justify-between pl-3"
          }`}
        >
          {!chanCollapsed && (
            <p className="flex min-w-0 items-center gap-2 font-heading text-sm">
              <span className="text-lg leading-none">{group.icon ?? "💬"}</span>
              <span className="truncate">{group.name}</span>
              {groupMuted && (
                <span title="Group muted" aria-label="Group muted">
                  🔕
                </span>
              )}
            </p>
          )}
          <button
            type="button"
            aria-label={chanCollapsed ? "Expand channels" : "Collapse channels"}
            title={chanCollapsed ? "Expand" : "Collapse"}
            className="rounded p-1.5 text-ink-dim transition-colors hover:bg-overlay-strong hover:text-ink"
            onClick={toggleChanCollapsed}
          >
            <ChevronLeftIcon
              className={`h-4 w-4 ${chanCollapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {!chanCollapsed && (
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-ink-dim">
              Channels
            </p>
            {canMod && (
              <button
                type="button"
                aria-label="New channel"
                title="New channel"
                className="rounded p-0.5 text-ink-dim transition-colors hover:text-arcane-bright"
                onClick={() => void addChannel()}
              >
                +
              </button>
            )}
          </div>
        )}
        <nav
          className={`min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-2 ${
            chanCollapsed ? "px-1.5 pt-2" : "px-2"
          }`}
        >
          {channels.map((c) => (
            <div key={c.id} className="group/chan flex items-center">
              <button
                type="button"
                title={`#${c.name}${c.muted ? " (muted)" : ""}`}
                className={`relative flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  chanCollapsed ? "justify-center" : ""
                } ${
                  c.id === channelId
                    ? "bg-arcane/15 text-arcane-bright"
                    : c.muted
                      ? "text-ink-dim/50 hover:bg-overlay-strong hover:text-ink-dim"
                      : "text-ink-dim hover:bg-overlay-strong hover:text-ink"
                }`}
                onClick={() => setChannelId(c.id)}
              >
                <HashIcon className="h-3.5 w-3.5 shrink-0" />
                {!chanCollapsed && (
                  <>
                    <span
                      className={`truncate ${
                        c.unread && !c.muted ? "font-bold text-ink" : ""
                      }`}
                    >
                      {c.name}
                    </span>
                    {c.nsfw && (
                      <span className="shrink-0 rounded bg-red-400/15 px-1 text-[8px] font-heading uppercase tracking-wider text-red-400">
                        NSFW
                      </span>
                    )}
                    {c.postMode !== "everyone" && (
                      <LockIcon className="h-3 w-3 shrink-0 opacity-60" />
                    )}
                  </>
                )}
                {c.unread && !c.muted && (
                  <span
                    aria-label="Unread"
                    className={`h-1.5 w-1.5 shrink-0 rounded-full bg-arcane ${
                      chanCollapsed ? "absolute right-1 top-1" : "ml-auto"
                    }`}
                  />
                )}
              </button>
              {!chanCollapsed && (
                <span className="flex shrink-0 opacity-0 transition group-hover/chan:opacity-100">
                  <button
                    type="button"
                    aria-label={c.muted ? `Unmute #${c.name}` : `Mute #${c.name}`}
                    title={c.muted ? "Unmute" : "Mute"}
                    className="p-1 text-xs text-ink-dim hover:text-ink"
                    onClick={() => void toggleChannelMute(c)}
                  >
                    {c.muted ? "🔔" : "🔕"}
                  </button>
                  {canMod && channels.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Delete #${c.name}`}
                      className="p-1 text-ink-dim hover:text-red-400"
                      onClick={() => void removeChannel(c)}
                    >
                      ×
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </nav>

        <div
          className={`space-y-1.5 border-t border-edge p-2 ${
            chanCollapsed ? "text-center" : "p-3"
          }`}
        >
          <button
            type="button"
            title="Group settings"
            className={`rounded-md text-xs text-ink-dim transition-colors hover:text-ink hover:bg-overlay-strong ${
              chanCollapsed ? "p-1.5" : "flex w-full items-center gap-2 px-2 py-1.5"
            }`}
            onClick={() => setSettingsOpen(true)}
          >
            ⚙{!chanCollapsed && <span>Group settings</span>}
          </button>
          {!chanCollapsed && (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-dim transition-colors hover:bg-overlay-strong hover:text-ink"
                onClick={() => void toggleGroupMute()}
              >
                {groupMuted ? "🔔" : "🔕"}
                <span>{groupMuted ? "Unmute group" : "Mute group"}</span>
              </button>
              <button
                type="button"
                className="w-full px-2 py-1 text-left text-xs text-ink-dim transition-colors hover:text-red-400"
                onClick={() => void leaveOrDelete()}
              >
                {role === "owner" ? "Delete group" : "Leave group"}
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-edge px-3 sm:px-4">
          {/* Mobile channel picker + settings */}
          <select
            aria-label="Channel"
            className="input-arcane !w-auto !px-2 !py-1 text-sm md:hidden"
            value={channelId ?? ""}
            onChange={(e) => setChannelId(e.target.value)}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
                {c.unread && !c.muted ? " •" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Group settings"
            title="Group settings"
            className="rounded-md p-1.5 text-ink-dim transition-colors hover:bg-overlay hover:text-ink md:hidden"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙
          </button>
          <p className="hidden min-w-0 items-center gap-1.5 font-heading text-sm md:flex">
            <HashIcon className="h-4 w-4 text-ink-dim" />
            <span className="truncate">{channelName}</span>
            {channel?.nsfw && (
              <span className="shrink-0 rounded bg-red-400/15 px-1 text-[9px] font-heading uppercase tracking-wider text-red-400">
                NSFW
              </span>
            )}
            {channel && channel.postMode !== "everyone" && (
              <span
                className="flex items-center gap-1 text-[10px] text-ink-dim"
                title={
                  channel.postMode === "mods"
                    ? "Only the owner and admins can post"
                    : "Only certain ranks can post"
                }
              >
                <LockIcon className="h-3 w-3" />
                {channel.postMode === "mods" ? "Mods only" : "Rank-restricted"}
              </span>
            )}
          </p>
          <button
            type="button"
            className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-dim transition-colors hover:bg-overlay hover:text-ink lg:hidden"
            aria-expanded={showMembersMobile}
            onClick={() => setShowMembersMobile((v) => !v)}
          >
            <UsersIcon className="h-4 w-4" />
            {members.length}
          </button>
          <span className="ml-auto hidden items-center gap-2 lg:flex">
            <span className="flex items-center gap-1.5 text-xs text-ink-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {online.length} of {members.length} online
            </span>
            <button
              type="button"
              aria-label={membersOpen ? "Hide members" : "Show members"}
              title={membersOpen ? "Hide members" : "Show members"}
              className={`rounded-md p-1.5 transition-colors hover:bg-overlay ${
                membersOpen ? "text-arcane-bright" : "text-ink-dim"
              }`}
              onClick={toggleMembersOpen}
            >
              <UsersIcon className="h-4 w-4" />
            </button>
          </span>
        </div>

        <div className="relative flex min-h-0 flex-1">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-1 py-3 sm:px-2"
          >
            {/* NSFW gate — confirm before the channel renders */}
            {nsfwGated && channel ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-sm rounded-xl border border-red-400/30 p-6 text-center space-y-3">
                  <p className="font-heading text-lg">#{channel.name} is NSFW</p>
                  <p className="text-sm text-ink-dim">
                    This channel may contain adult or sensitive content. Are
                    you sure you want to view it?
                  </p>
                  <button
                    type="button"
                    className="btn-arcane text-xs px-4 py-2"
                    onClick={() => ackNsfw(channel.id)}
                  >
                    Show channel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Welcome banner (first channel only) */}
                {group.welcomeMessage &&
                  channelId === channels[0]?.id && (
                    <div className="mx-3 mb-3 rounded-xl border border-arcane/30 bg-arcane/5 px-4 py-3">
                      <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-arcane-bright mb-1">
                        Welcome
                      </p>
                      <p className="whitespace-pre-wrap text-sm">
                        {group.welcomeMessage}
                      </p>
                    </div>
                  )}
                {messages === null ? (
                  <p className="px-4 py-6 text-sm text-ink-dim">Loading…</p>
                ) : messages.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <p className="font-heading text-lg mb-1">#{channelName}</p>
                    <p className="text-sm text-ink-dim">
                      Nothing here yet. Say hello — paste a link to any book or
                      audiobook to share it as a card.
                    </p>
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const compact =
                      !!prev &&
                      prev.authorId === m.authorId &&
                      m.createdAt - prev.createdAt < 5 * 60 * 1000;
                    const authorMember = members.find(
                      (x) => x.id === m.authorId
                    );
                    const rank = authorMember?.rankId
                      ? rankById.get(authorMember.rankId)
                      : undefined;
                    return (
                      <MessageRow
                        key={m.id}
                        m={m}
                        compact={compact}
                        nameColor={rank?.color}
                      />
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* Members drawer (overlay on small, toggleable rail on lg+) */}
          <aside
            className={`${
              showMembersMobile ? "flex" : "hidden"
            } absolute inset-y-0 right-0 z-10 w-60 flex-col border-l border-edge bg-void-raised lg:static lg:z-auto lg:bg-overlay ${
              membersOpen ? "lg:flex" : "lg:hidden"
            }`}
          >
            <p className="border-b border-edge px-3 py-2.5 text-[10px] font-heading uppercase tracking-[0.2em] text-ink-dim">
              Members — {members.length}
            </p>
            {memberList}
          </aside>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-edge p-3">
          {error && <p className="mb-1 text-xs text-red-400">{error}</p>}
          {!canPostHere && channel ? (
            <p className="rounded-md border border-edge bg-overlay px-3 py-2 text-xs text-ink-dim">
              <LockIcon className="mr-1.5 inline h-3 w-3" />
              {channel.postMode === "mods"
                ? "Only the owner and admins can post in this channel."
                : "Only certain ranks can post here — ask a mod for the rank."}
            </p>
          ) : (
            <>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <button
                  type="button"
                  title={`Content flag: ${flagLabel} — click to change`}
                  aria-label={`Content flag: ${flagLabel}`}
                  className={`shrink-0 rounded-md border px-2 py-2 text-xs transition-colors ${
                    flag === "nsfw"
                      ? "border-red-400/50 text-red-400"
                      : flag === "spoiler"
                        ? "border-ember/50 text-ember"
                        : "border-edge text-ink-dim hover:text-ink"
                  }`}
                  onClick={() =>
                    setFlag((f) =>
                      f === null ? "spoiler" : f === "spoiler" ? "nsfw" : null
                    )
                  }
                >
                  {flag === "nsfw" ? "18+" : flag === "spoiler" ? "⚠" : "◎"}
                </button>
                <textarea
                  aria-label={`Message #${channelName}`}
                  className="input-arcane max-h-40 min-h-0 flex-1 resize-none !py-2"
                  rows={1}
                  placeholder={
                    flag
                      ? `Message #${channelName} (${flagLabel.toLowerCase()} — hidden until clicked)`
                      : `Message #${channelName}`
                  }
                  value={draft}
                  maxLength={2000}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  type="submit"
                  aria-label="Send"
                  className="btn-arcane !px-3"
                  disabled={busy || !draft.trim()}
                >
                  <SendIcon className="h-4 w-4" />
                </button>
              </form>
              <p className="mt-1 text-[10px] text-ink-dim">
                Enter to send · Shift+Enter for a new line · ◎ flags a message
                as spoiler/NSFW · paste a Vellum book or series link to share it
              </p>
            </>
          )}
        </div>
      </div>

      {moderating && (
        <ModerateDialog
          m={moderating}
          groupId={group.id}
          myRole={role}
          onClose={() => setModerating(null)}
          onDone={() => {
            setModerating(null);
            router.refresh();
          }}
        />
      )}

      {settingsOpen && (
        <GroupSettingsDialog
          group={group}
          role={role}
          channels={channels}
          ranks={ranks}
          members={members}
          invitable={invitable}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
