/**
 * Server-rendered charts for the author Home page. Pure SVG/CSS on the app's
 * theme tokens — no chart library, no client JS.
 */

export function ViewsAreaChart({
  data,
}: {
  data: { day: string; views: number }[];
}) {
  const W = 560;
  const H = 150;
  const PAD = 8;
  const max = Math.max(1, ...data.map((d) => d.views));
  const stepX = (W - PAD * 2) / Math.max(1, data.length - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const points = data.map((d, i) => `${PAD + i * stepX},${y(d.views)}`);
  const line = `M ${points.join(" L ")}`;
  const area = `${line} L ${PAD + (data.length - 1) * stepX},${H - PAD} L ${PAD},${H - PAD} Z`;
  const label = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Reads per day over the last 28 days"
      >
        <defs>
          <linearGradient id="views-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--arcane)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--arcane)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line
          x1={PAD}
          y1={H - PAD}
          x2={W - PAD}
          y2={H - PAD}
          stroke="var(--void-border)"
          strokeWidth="1"
        />
        <path d={area} fill="url(#views-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--arcane-bright)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Latest point, emphasized */}
        <circle
          cx={PAD + (data.length - 1) * stepX}
          cy={y(data[data.length - 1]?.views ?? 0)}
          r="3.5"
          fill="var(--arcane-bright)"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-ink-dim mt-1">
        <span>{data.length > 0 ? label(data[0].day) : ""}</span>
        <span>peak {max === 1 && data.every((d) => d.views === 0) ? 0 : max}/day</span>
        <span>{data.length > 0 ? label(data[data.length - 1].day) : ""}</span>
      </div>
    </div>
  );
}

export function ViewsByWorkBars({
  data,
}: {
  data: { journalId: string; title: string; views: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.views));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.journalId}>
          <div className="flex items-baseline justify-between gap-3 text-xs mb-1">
            <span className="truncate font-heading">{d.title}</span>
            <span className="text-ink-dim whitespace-nowrap">
              {d.views} read{d.views === 1 ? "" : "s"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-overlay overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (d.views / max) * 100)}%`,
                background:
                  "linear-gradient(90deg, var(--arcane), var(--arcane-bright))",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
