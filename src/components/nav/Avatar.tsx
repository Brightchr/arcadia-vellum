/** Small round avatar: uploaded image, or an initial on an arcane disc. */
export function Avatar({
  name,
  avatarImageId,
  size = 32,
}: {
  name: string;
  avatarImageId?: string | null;
  size?: number;
}) {
  if (avatarImageId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatars/${avatarImageId}`}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-void-border"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className="inline-flex items-center justify-center rounded-full bg-arcane/20 text-arcane-bright font-heading border border-arcane/40 shrink-0"
      aria-hidden
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
