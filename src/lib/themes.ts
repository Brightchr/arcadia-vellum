export type ThemeId =
  | "midnight"
  | "daylight"
  | "witch-grimoire"
  | "ancient-tome"
  | "elven-chronicle"
  | "captains-log"
  | "arcane-codex";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  /** "standard" = clean dark/light dashboard; "fantasy" = themed binding. */
  kind: "standard" | "fantasy";
}

export const THEMES: ThemeDef[] = [
  {
    id: "midnight",
    name: "Midnight (Dark)",
    description: "A clean, modern dark dashboard — no parchment, no glow.",
    kind: "standard",
  },
  {
    id: "daylight",
    name: "Daylight (Light)",
    description: "A bright, minimal light dashboard for daytime reading.",
    kind: "standard",
  },
  {
    id: "witch-grimoire",
    name: "Witch's Grimoire",
    description:
      "Serpent-scale black binding — royal purple and deep teal inks on ashen pages.",
    kind: "fantasy",
  },
  {
    id: "ancient-tome",
    name: "Ancient Tome",
    description:
      "Weathered parchment and sepia ink, headed in heavy blackletter.",
    kind: "fantasy",
  },
  {
    id: "elven-chronicle",
    name: "Elven Chronicle",
    description:
      "Pale silver-green leaves and flowing elegant script from the elder courts.",
    kind: "fantasy",
  },
  {
    id: "captains-log",
    name: "Captain's Log",
    description:
      "Salt-stained pages, ink blots, and a bold hand that survived the storm.",
    kind: "fantasy",
  },
  {
    id: "arcane-codex",
    name: "Arcane Codex",
    description:
      "Midnight blue and gold leaf — a star-chart of forbidden astronomy.",
    kind: "fantasy",
  },
];

export const DEFAULT_THEME: ThemeId = "witch-grimoire";

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Sanitizes a stored dashboard-theme value into an app chrome class. */
export function appThemeClass(value: unknown): string {
  const id =
    typeof value === "string" && isThemeId(value) ? value : DEFAULT_THEME;
  return `app-theme-${id}`;
}
