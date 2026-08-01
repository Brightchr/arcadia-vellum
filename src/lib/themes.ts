export type ThemeId =
  | "witch-grimoire"
  | "ancient-tome"
  | "elven-chronicle"
  | "captains-log"
  | "arcane-codex";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: "witch-grimoire",
    name: "Witch's Grimoire",
    description:
      "Black leather bound in silver thread — poison-green sigils and a spidery hand.",
  },
  {
    id: "ancient-tome",
    name: "Ancient Tome",
    description:
      "Weathered parchment and sepia ink, headed in heavy blackletter.",
  },
  {
    id: "elven-chronicle",
    name: "Elven Chronicle",
    description:
      "Pale silver-green leaves and flowing elegant script from the elder courts.",
  },
  {
    id: "captains-log",
    name: "Captain's Log",
    description:
      "Salt-stained pages, ink blots, and a bold hand that survived the storm.",
  },
  {
    id: "arcane-codex",
    name: "Arcane Codex",
    description:
      "Midnight blue and gold leaf — a star-chart of forbidden astronomy.",
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
