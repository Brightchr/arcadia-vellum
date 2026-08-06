import Link from "next/link";
import type { Work } from "@/lib/discovery";
import { Stars } from "./StarRating";
import { BookOpenIcon, HeadphonesIcon, LockIcon } from "@/components/icons";

export function workHref(work: Pick<Work, "kind" | "slug">) {
  return work.kind === "series" ? `/series/${work.slug}` : `/book/${work.slug}`;
}

/** Cover thumb: uploaded art, or a miniature themed tome cover. */
export function WorkCover({
  work,
  className = "",
}: {
  work: Pick<Work, "title" | "author" | "theme" | "coverImageId">;
  className?: string;
}) {
  if (work.coverImageId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/images/${work.coverImageId}`}
        alt=""
        className={`aspect-[3/4] w-full object-cover rounded-lg border border-white/10 ${className}`}
      />
    );
  }
  return (
    <div className={`theme-${work.theme} aspect-[3/4] w-full ${className}`}>
      <div className="tome-cover !p-3 rounded-lg overflow-hidden h-full">
        <div className="tome-cover-ornament tome-cover-ornament--front" />
        <h3 className="tome-cover-title !text-sm line-clamp-3">{work.title}</h3>
        <hr className="tome-cover-rule" />
        {work.author && (
          <p className="tome-cover-author !bottom-3 !text-[10px] truncate">
            {work.author}
          </p>
        )}
      </div>
    </div>
  );
}

/** Browse/saved-shelf card for a public work. */
export function WorkCard({ work }: { work: Work }) {
  return (
    <Link
      href={workHref(work)}
      className="group block panel-arcane p-3 hover:border-arcane/60 transition-colors"
    >
      <WorkCover work={work} className="mb-3 group-hover:opacity-95" />
      <h3 className="font-heading text-sm leading-snug truncate" title={work.title}>
        {work.title}
      </h3>
      <p className="text-xs text-ink-dim truncate">
        {work.author ?? work.ownerName}
      </p>
      <div className="flex items-center gap-2 mt-1.5 text-xs text-ink-dim">
        {work.restricted && (
          <LockIcon className="h-3.5 w-3.5 text-arcane-bright" />
        )}
        {work.hasWritten && <BookOpenIcon className="h-3.5 w-3.5" />}
        {work.hasAudio && <HeadphonesIcon className="h-3.5 w-3.5" />}
        {work.volumeCount > 1 && <span>{work.volumeCount} vols</span>}
        {work.avgRating !== null && (
          <span className="inline-flex items-center gap-1 ml-auto">
            <Stars value={work.avgRating} size={11} />
            <span>({work.ratingCount})</span>
          </span>
        )}
      </div>
      {work.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {work.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-heading uppercase tracking-wider text-ink-dim"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
