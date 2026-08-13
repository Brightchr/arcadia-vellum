"use client";

import type { ChannelState } from "@/lib/groups";
import {
  BellIcon,
  BellOffIcon,
  EyeIcon,
  GearIcon,
  HashIcon,
  TrashIcon,
} from "@/components/icons";

/**
 * Discord-style channel sheet — long-press (or right-click) a channel to get
 * it. Bottom sheet on phones, centered card on larger screens.
 */
export function ChannelMenu({
  channel,
  canMod,
  canDelete,
  onMarkRead,
  onToggleMute,
  onEdit,
  onDelete,
  onClose,
}: {
  channel: ChannelState;
  canMod: boolean;
  canDelete: boolean;
  onMarkRead: () => void;
  onToggleMute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const row = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    danger = false
  ) => (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors ${
        danger
          ? "text-red-400 hover:bg-red-400/10"
          : "hover:bg-overlay-strong"
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Channel options for #${channel.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel-arcane w-full max-w-sm !rounded-b-none p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:!rounded-b-xl">
        <p className="flex items-center gap-2 px-4 py-3 font-heading text-sm">
          <HashIcon className="h-4 w-4 text-ink-dim" />
          {channel.name}
          {channel.nsfw && (
            <span className="rounded bg-red-400/15 px-1 text-[9px] font-heading uppercase tracking-wider text-red-400">
              NSFW
            </span>
          )}
        </p>
        <div className="border-t border-void-border pt-1">
          {row(
            <EyeIcon className="h-4 w-4 text-ink-dim" />,
            "Mark as Read",
            onMarkRead
          )}
          {row(
            channel.muted ? (
              <BellIcon className="h-4 w-4 text-ink-dim" />
            ) : (
              <BellOffIcon className="h-4 w-4 text-ink-dim" />
            ),
            channel.muted ? "Unmute Channel" : "Mute Channel",
            onToggleMute
          )}
          {canMod &&
            row(
              <GearIcon className="h-4 w-4 text-ink-dim" />,
              "Edit Channel",
              onEdit
            )}
          {canMod &&
            canDelete &&
            row(
              <TrashIcon className="h-4 w-4" />,
              "Delete Channel",
              onDelete,
              true
            )}
        </div>
      </div>
    </div>
  );
}
