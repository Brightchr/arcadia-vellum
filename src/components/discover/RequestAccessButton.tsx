"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkKind } from "@/lib/reviews";

/** Ask the owner for access to a restricted work. */
export function RequestAccessButton({
  kind,
  itemId,
  status: initialStatus,
  signedIn,
}: {
  kind: WorkKind;
  itemId: string;
  status: "none" | "pending";
  signedIn: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);

  if (status === "pending") {
    return (
      <span className="btn-ghost pointer-events-none opacity-80">
        Access Requested ✓
      </span>
    );
  }

  return (
    <button
      type="button"
      className="btn-arcane"
      disabled={busy}
      onClick={async () => {
        if (!signedIn) {
          router.push("/login");
          return;
        }
        setBusy(true);
        try {
          const res = await fetch("/api/access", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, itemId }),
          });
          if (res.ok) {
            setStatus("pending");
            router.refresh();
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      Request Access
    </button>
  );
}
