"use client";

/** Curated icon set — tap to pick, tap again to clear. No typing required. */
const ICONS = [
  "📖", "📚", "📜", "🖋️", "🕯️", "🔮", "🧙", "🐉",
  "⚔️", "🛡️", "🏰", "🎲", "🗺️", "👑", "💀", "🐺",
  "🦉", "🌙", "⭐", "🔥", "🌿", "🍺", "🎻", "🚀",
];

export function IconPicker({
  value,
  onChange,
  label = "Icon",
}: {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-ink-dim">
        {label}
        {value && (
          <button
            type="button"
            className="ml-2 text-[10px] uppercase tracking-wider text-ink-dim hover:text-ink"
            onClick={() => onChange("")}
          >
            Clear
          </button>
        )}
      </p>
      <div className="flex flex-wrap gap-1">
        {ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            aria-label={`Icon ${icon}`}
            aria-pressed={value === icon}
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${
              value === icon
                ? "bg-arcane/25 ring-1 ring-arcane"
                : "bg-overlay hover:bg-overlay-strong"
            }`}
            onClick={() => onChange(value === icon ? "" : icon)}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}
