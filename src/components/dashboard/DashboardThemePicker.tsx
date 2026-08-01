"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { THEMES, type ThemeId } from "@/lib/themes";

const SWATCHES: Record<ThemeId, [string, string]> = {
  "witch-grimoire": ["#c4a9f0", "#8fae6e"],
  "ancient-tome": ["#eec678", "#b0512f"],
  "elven-chronicle": ["#aedec0", "#d8c66a"],
  "captains-log": ["#85cfe0", "#d8aa5c"],
  "arcane-codex": ["#f2d896", "#8ea0d8"],
};

/** Round swatches that set (and persist) the user's app chrome theme. */
export function DashboardThemePicker({ current }: { current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pick(id: ThemeId) {
    if (busy || id === current) return;
    setBusy(true);
    try {
      await authClient.updateUser({ dashboardTheme: id } as Parameters<
        typeof authClient.updateUser
      >[0]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex items-center gap-2"
      role="radiogroup"
      aria-label="Dashboard theme"
    >
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={current === t.id}
          title={t.name}
          disabled={busy}
          onClick={() => pick(t.id)}
          className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${
            current === t.id
              ? "ring-2 ring-arcane-bright ring-offset-2 ring-offset-void scale-110"
              : "opacity-70"
          }`}
          style={{
            background: `linear-gradient(135deg, ${SWATCHES[t.id][0]}, ${SWATCHES[t.id][1]})`,
          }}
        />
      ))}
    </div>
  );
}
