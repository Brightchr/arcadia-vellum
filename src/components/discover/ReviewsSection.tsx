"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { WorkKind } from "@/lib/reviews";
import { Stars, StarPicker } from "./StarRating";
import { Avatar } from "@/components/nav/Avatar";

export interface ReviewView {
  id: string;
  userId: string;
  rating: number;
  body: string | null;
  updatedAt: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarId: string | null;
  authorRole?: string;
}

export function ReviewsSection({
  kind,
  itemId,
  reviews,
  viewerId,
  isOwner,
  signedIn,
  canReview = true,
}: {
  kind: WorkKind;
  itemId: string;
  reviews: ReviewView[];
  viewerId: string | null;
  isOwner: boolean;
  signedIn: boolean;
  /** False when the viewer lacks access to the work (form hidden). */
  canReview?: boolean;
}) {
  const router = useRouter();
  const mine = reviews.find((r) => r.userId === viewerId) ?? null;
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) {
      setError("Pick a star rating first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, itemId, rating, body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.error ?? "Could not save the review.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch("/api/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, itemId }),
      });
      setRating(0);
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel-arcane p-5 sm:p-6 space-y-5">
      <h2 className="font-heading text-lg">
        Reviews{reviews.length > 0 && ` (${reviews.length})`}
      </h2>

      {signedIn && !isOwner && !canReview && (
        <p className="text-sm text-ink-dim border-b border-void-border pb-5">
          Reviews are open to readers with access to this work.
        </p>
      )}
      {signedIn && !isOwner && canReview && (
        <div className="space-y-3 border-b border-void-border pb-5">
          <div className="flex items-center gap-3">
            <StarPicker value={rating} onChange={setRating} />
            <span className="text-xs text-ink-dim">
              {mine ? "Update your review" : "Leave a review"}
            </span>
          </div>
          <textarea
            value={body}
            maxLength={2000}
            placeholder="What did you think? (optional)"
            className="input-arcane min-h-24 resize-y"
            onChange={(e) => setBody(e.target.value)}
          />
          {error && (
            <p className="text-red-400 text-xs" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-arcane"
              disabled={busy}
              onClick={submit}
            >
              {busy ? "Saving..." : mine ? "Update Review" : "Post Review"}
            </button>
            {mine && (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={remove}
              >
                Delete Mine
              </button>
            )}
          </div>
        </div>
      )}
      {!signedIn && (
        <p className="text-sm text-ink-dim border-b border-void-border pb-5">
          <Link href="/login" className="text-arcane-bright hover:underline">
            Sign in
          </Link>{" "}
          to leave a review.
        </p>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-ink-dim italic">
          No reviews yet — be the first.
        </p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="flex gap-3">
              <Avatar name={r.authorName} avatarImageId={r.authorAvatarId} size={34} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {r.authorUsername ? (
                    <Link
                      href={`/u/${r.authorUsername}`}
                      className="text-sm font-heading text-arcane-bright hover:underline"
                    >
                      {r.authorName}
                    </Link>
                  ) : (
                    <span className="text-sm font-heading">{r.authorName}</span>
                  )}
                  {r.authorRole === "admin" && (
                    <span className="inline-flex items-center rounded-full bg-arcane/20 border border-arcane/50 px-1.5 py-0.5 text-[9px] font-heading uppercase tracking-widest text-arcane-bright">
                      Admin
                    </span>
                  )}
                  <Stars value={r.rating} size={12} />
                  <span className="text-xs text-ink-dim">
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                {r.body && (
                  <p className="text-sm text-ink mt-1 whitespace-pre-wrap">
                    {r.body}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
