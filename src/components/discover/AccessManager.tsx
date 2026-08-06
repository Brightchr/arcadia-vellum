"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/nav/Avatar";
import type { GrantView } from "@/lib/access";
import type { WorkKind } from "@/lib/reviews";

/** Owner panel: approve, deny, and revoke access to a restricted work. */
export function AccessManager({
  kind,
  itemId,
  grants,
}: {
  kind: WorkKind;
  itemId: string;
  grants: GrantView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const pending = grants.filter((g) => g.status === "pending");
  const granted = grants.filter((g) => g.status === "granted");

  async function decide(userId: string, action: "grant" | "revoke") {
    setBusy(true);
    try {
      await fetch("/api/access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, itemId, userId, action }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const row = (g: GrantView, actions: React.ReactNode) => (
    <li key={g.userId} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/5">
      <Avatar name={g.name} avatarImageId={g.avatarImageId} size={32} />
      <span className="min-w-0 flex-1 text-sm truncate">
        {g.name}
        {g.username && (
          <span className="text-ink-dim text-xs ml-1.5">@{g.username}</span>
        )}
      </span>
      <span className="flex items-center gap-2 shrink-0">{actions}</span>
    </li>
  );

  return (
    <section className="panel-arcane p-5 sm:p-6 space-y-4">
      <h2 className="font-heading text-lg">Access</h2>
      {pending.length === 0 && granted.length === 0 ? (
        <p className="text-sm text-ink-dim italic">
          No access requests yet. Readers who find this work can ask, and
          you&apos;ll get a notification.
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <div>
              <p className="text-sm text-ink-dim mb-1.5">
                Pending requests ({pending.length})
              </p>
              <ul className="space-y-1">
                {pending.map((g) =>
                  row(
                    g,
                    <>
                      <button
                        type="button"
                        className="btn-arcane text-xs px-3 py-1.5"
                        disabled={busy}
                        onClick={() => void decide(g.userId, "grant")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs px-3 py-1.5"
                        disabled={busy}
                        onClick={() => void decide(g.userId, "revoke")}
                      >
                        Deny
                      </button>
                    </>
                  )
                )}
              </ul>
            </div>
          )}
          {granted.length > 0 && (
            <div>
              <p className="text-sm text-ink-dim mb-1.5">
                Has access ({granted.length})
              </p>
              <ul className="space-y-1">
                {granted.map((g) =>
                  row(
                    g,
                    <button
                      type="button"
                      className="btn-ghost text-xs px-3 py-1.5"
                      disabled={busy}
                      onClick={() => void decide(g.userId, "revoke")}
                    >
                      Revoke
                    </button>
                  )
                )}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
