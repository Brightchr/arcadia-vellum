"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The little ✕ on work cards: "don't show me this again". Appears on hover,
 * records the dislike (which also teaches the For-you ranking what to avoid),
 * and refreshes the listing.
 */
export function NotInterestedButton({
  kind,
  itemId,
}: {
  kind: "journal" | "series";
  itemId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      aria-label="Not interested"
      title="Not interested — hide this and show me less like it"
      className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/80 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:bg-black/80 hover:text-white"
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try {
          await fetch("/api/dislikes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, itemId }),
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      ✕
    </button>
  );
}
