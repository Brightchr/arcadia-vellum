"use client";

/** Read-only star row (fractional averages round to halves visually). */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-arcane-bright"
      aria-label={`${value.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill={value >= i - 0.25 ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
        </svg>
      ))}
    </span>
  );
}

/** Interactive star picker for the review form. */
export function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          className={`transition-transform hover:scale-110 ${
            value >= i ? "text-arcane-bright" : "text-ink-dim"
          }`}
          onClick={() => onChange(i)}
        >
          <svg
            viewBox="0 0 24 24"
            width={22}
            height={22}
            fill={value >= i ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.6}
            aria-hidden
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
          </svg>
        </button>
      ))}
    </div>
  );
}
