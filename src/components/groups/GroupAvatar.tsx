import { MessageSquareIcon } from "@/components/icons";

/**
 * A group's face, smallest to largest: uploaded image → emoji icon →
 * generic chat glyph. `className` sizes the square (e.g. "h-10 w-10").
 */
export function GroupAvatar({
  imageId,
  icon,
  className = "h-10 w-10",
  iconClassName = "text-xl",
}: {
  imageId: string | null;
  icon: string | null;
  className?: string;
  iconClassName?: string;
}) {
  if (imageId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatars/${imageId}`}
        alt=""
        className={`${className} shrink-0 rounded-xl object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${className} flex shrink-0 items-center justify-center rounded-xl bg-overlay-strong ${iconClassName}`}
    >
      {icon ?? <MessageSquareIcon className="h-[45%] w-[45%] text-ink-dim" />}
    </span>
  );
}
