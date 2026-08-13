import Link from "next/link";
import type { Work } from "@/lib/discovery";
import { WorkCard } from "./WorkCard";

/**
 * A horizontal home-feed shelf: heading, optional "Show all" link, and a
 * scrollable strip of work cards. Renders nothing when empty.
 */
export function WorkRow({
  title,
  subtitle,
  works,
  showAllHref,
  limit = 10,
  dismissable = false,
}: {
  title: string;
  subtitle?: string;
  works: Work[];
  showAllHref?: string;
  limit?: number;
  /** Let signed-in readers hide works with "Not interested". */
  dismissable?: boolean;
}) {
  if (works.length === 0) return null;
  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="font-heading text-lg">{title}</h2>
          {subtitle && <p className="text-xs text-ink-dim">{subtitle}</p>}
        </div>
        {showAllHref && (
          <Link
            href={showAllHref}
            className="text-xs font-heading text-ink-dim hover:text-arcane-bright transition-colors shrink-0"
          >
            Show all
          </Link>
        )}
      </div>
      {/* overflow-y-hidden + overscroll containment keep vertical swipes
          flowing to the page instead of getting trapped by the strip */}
      <div className="flex gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 -mx-1 px-1">
        {works.slice(0, limit).map((w) => (
          <div key={`${w.kind}:${w.id}`} className="w-40 sm:w-44 shrink-0">
            <WorkCard work={w} dismissable={dismissable} />
          </div>
        ))}
      </div>
    </section>
  );
}
