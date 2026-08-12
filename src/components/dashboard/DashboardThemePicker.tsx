"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { THEMES, isThemeId } from "@/lib/themes";

/** Dropdown that sets (and persists) the user's app chrome theme. */
export function DashboardThemePicker({ current }: { current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pick(id: string) {
    if (busy || !isThemeId(id) || id === current) return;
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
    <select
      className="input-arcane !w-auto !py-1.5 !px-2.5 text-sm"
      value={current}
      aria-label="Dashboard theme"
      disabled={busy}
      onChange={(e) => void pick(e.target.value)}
    >
      <optgroup label="Standard">
        {THEMES.filter((t) => t.kind === "standard").map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Fantasy">
        {THEMES.filter((t) => t.kind === "fantasy").map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
