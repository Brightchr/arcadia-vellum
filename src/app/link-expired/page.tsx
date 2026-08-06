import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link expired — Vellum",
};

/** Landing spot for revoked, expired, or invalid share links. */
export default function LinkExpiredPage() {
  return (
    <main className="arcane-bg min-h-dvh flex items-center justify-center p-6">
      <div className="panel-arcane p-10 max-w-md text-center space-y-4">
        <h1 className="font-display text-2xl text-arcane-bright">
          This share link is no longer active.
        </h1>
        <p className="text-sm text-ink-dim">
          The author may have revoked it, or it expired. Ask them for a fresh
          link — or browse the public archives instead.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn-ghost">
            Home
          </Link>
          <Link href="/browse" className="btn-arcane">
            Browse
          </Link>
        </div>
      </div>
    </main>
  );
}
