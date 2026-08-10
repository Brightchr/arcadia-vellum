/**
 * The building blocks custom themes and cover overrides are assembled from.
 * Everything here is a fixed whitelist: fonts are the ones the layout already
 * loads, textures are pure CSS/SVG layers, ambiences are the five existing
 * scene animations. Users combine these — they can't inject their own CSS.
 */

export interface ThemeFont {
  id: string;
  name: string;
  /** CSS font-family stack (font vars are defined by the root layout). */
  css: string;
}

export const THEME_FONTS: ThemeFont[] = [
  { id: "fell", name: "Fell English", css: "var(--font-fell), serif" },
  { id: "cinzel", name: "Cinzel", css: "var(--font-cinzel), serif" },
  {
    id: "cinzel-deco",
    name: "Cinzel Decorative",
    css: "var(--font-cinzel-deco), serif",
  },
  {
    id: "unifraktur",
    name: "Blackletter",
    css: "var(--font-unifraktur), serif",
  },
  { id: "cormorant", name: "Cormorant", css: "var(--font-cormorant), serif" },
  { id: "garamond", name: "Garamond", css: "var(--font-garamond), serif" },
  { id: "pirata", name: "Pirata", css: "var(--font-pirata), serif" },
  { id: "caveat", name: "Handwritten", css: "var(--font-caveat), cursive" },
];

export function isFontId(value: unknown): value is string {
  return (
    typeof value === "string" && THEME_FONTS.some((f) => f.id === value)
  );
}

export function fontCss(id: string | undefined | null): string | null {
  return THEME_FONTS.find((f) => f.id === id)?.css ?? null;
}

/**
 * Texture overlays. Monochrome (white/black alphas only) so they read over
 * any base color the user picks. Each is a background-image layer list.
 */
export interface ThemeTexture {
  id: string;
  name: string;
  /** background-image layers, or null for a plain surface. */
  layers: string | null;
  /** Matching background-size entries (one per layer, comma-separated). */
  sizes?: string;
  /** Matching background-position entries. */
  positions?: string;
}

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E\")";
const FIBERS =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.012 0.05' numOctaves='2'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23f)' opacity='0.045'/%3E%3C/svg%3E\")";

export const THEME_TEXTURES: ThemeTexture[] = [
  { id: "none", name: "Smooth", layers: null },
  { id: "grain", name: "Paper Grain", layers: NOISE },
  {
    id: "laid",
    name: "Laid Paper",
    layers: `${NOISE}, ${FIBERS}, repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.03) 0 1px, transparent 1px 24px)`,
  },
  {
    id: "scales",
    name: "Serpent Scales",
    layers:
      `${NOISE}, radial-gradient(circle farthest-side at 50% 135%, rgba(255, 255, 255, 0.06) 62%, rgba(0, 0, 0, 0.42) 66%, transparent 70%), radial-gradient(circle farthest-side at 50% 135%, rgba(255, 255, 255, 0.03) 62%, rgba(0, 0, 0, 0.42) 66%, transparent 70%)`,
    sizes: "auto, 34px 26px, 34px 26px",
    positions: "0 0, 0 0, 17px 13px",
  },
  {
    id: "stars",
    name: "Starfield",
    layers:
      `${NOISE}, radial-gradient(circle at 18% 22%, rgba(255, 255, 255, 0.12) 0 1.5px, transparent 2.4px), radial-gradient(circle at 72% 12%, rgba(255, 255, 255, 0.14) 0 1px, transparent 2px), radial-gradient(circle at 85% 60%, rgba(255, 255, 255, 0.1) 0 1.2px, transparent 2.2px), radial-gradient(circle at 35% 78%, rgba(255, 255, 255, 0.12) 0 1px, transparent 1.8px), radial-gradient(circle at 55% 40%, rgba(255, 255, 255, 0.08) 0 1px, transparent 1.8px)`,
    sizes: "auto, 220px 220px, 220px 220px, 220px 220px, 220px 220px, 220px 220px",
  },
  {
    id: "weave",
    name: "Cloth Weave",
    layers:
      `${NOISE}, repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.06) 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.06) 0 1px, transparent 1px 5px)`,
  },
];

export function isTextureId(value: unknown): value is string {
  return (
    typeof value === "string" && THEME_TEXTURES.some((t) => t.id === value)
  );
}

export function textureById(id: string | undefined | null): ThemeTexture | null {
  return THEME_TEXTURES.find((t) => t.id === id) ?? null;
}

/** Ornament glyphs used for chapter heads, rules, and cover flourishes. */
export const THEME_ORNAMENTS = [
  "✦",
  "✧",
  "✷",
  "❦",
  "❧",
  "❉",
  "⚜",
  "☾",
  "ᛉ",
  "🜁",
] as const;

export function isOrnament(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (THEME_ORNAMENTS as readonly string[]).includes(value)
  );
}

/**
 * Ambience scenes — the animated backdrops behind the book. The animation
 * structure is shared (glow, mist, glyphs, motes); each preset supplies the
 * scene's colors, glyph characters, and backdrop. These mirror the five
 * built-in themes; custom themes pick one, never define their own motion.
 */
export interface AmbiencePreset {
  id: string;
  name: string;
  /** CSS custom properties for the scene (--sc-*). */
  vars: Record<string, string>;
  /** The scene's backdrop (background shorthand value). */
  background: string;
  /** Four glyph characters cycled across the drifting runes. */
  glyphs: [string, string, string, string];
}

export const AMBIENCE_PRESETS: AmbiencePreset[] = [
  {
    id: "witchfire",
    name: "Witchfire",
    vars: {
      "--sc-glyph": "#6e9fa0",
      "--sc-glyph-glow": "rgba(140, 80, 170, 0.65)",
      "--sc-mote": "#9fd4d5",
      "--sc-mote-glow": "rgba(110, 180, 185, 0.5)",
      "--sc-glow-a": "rgba(120, 60, 150, 0.17)",
      "--sc-glow-b": "rgba(80, 40, 100, 0.07)",
      "--sc-mist": "rgba(110, 159, 160, 0.07)",
    },
    background:
      "radial-gradient(ellipse at 50% 118%, rgba(73, 33, 83, 0.22), transparent 48%), radial-gradient(ellipse at 50% 32%, rgba(53, 86, 84, 0.14), transparent 60%), radial-gradient(ellipse at center, #0b0d12 0%, #08060c 55%, #030204 100%)",
    glyphs: ["ᛉ", "ᚱ", "ᛗ", "ᛟ"],
  },
  {
    id: "scriptorium",
    name: "Candlelit Scriptorium",
    vars: {
      "--sc-glyph": "#d8a86a",
      "--sc-glyph-glow": "rgba(216, 168, 106, 0.7)",
      "--sc-mote": "#e8c06a",
      "--sc-mote-glow": "rgba(232, 192, 106, 0.5)",
      "--sc-glow-a": "rgba(232, 170, 70, 0.24)",
      "--sc-glow-b": "rgba(190, 120, 40, 0.1)",
    },
    background:
      "radial-gradient(ellipse at 50% 118%, rgba(232, 170, 70, 0.18), transparent 48%), radial-gradient(ellipse at 50% 30%, rgba(120, 80, 30, 0.14), transparent 60%), radial-gradient(ellipse at center, #180f06 0%, #0f0903 55%, #060301 100%)",
    glyphs: ["❦", "❧", "✦", "❉"],
  },
  {
    id: "moonlit-forest",
    name: "Moonlit Forest",
    vars: {
      "--sc-glyph": "#a8d8b0",
      "--sc-glyph-glow": "rgba(168, 216, 176, 0.7)",
      "--sc-mote": "#cde86a",
      "--sc-mote-glow": "rgba(205, 232, 106, 0.55)",
      "--sc-glow-a": "rgba(190, 230, 200, 0.14)",
      "--sc-glow-b": "rgba(140, 190, 150, 0.06)",
      "--sc-mist": "rgba(168, 216, 186, 0.09)",
    },
    background:
      "radial-gradient(ellipse at 50% -12%, rgba(200, 240, 214, 0.13), transparent 48%), radial-gradient(ellipse at 50% 80%, rgba(40, 80, 55, 0.18), transparent 60%), radial-gradient(ellipse at center, #0b1610 0%, #071009 55%, #030604 100%)",
    glyphs: ["❧", "✧", "❃", "✦"],
  },
  {
    id: "night-sea",
    name: "Night Sea",
    vars: {
      "--sc-glyph": "#8fc4d8",
      "--sc-glyph-glow": "rgba(143, 196, 216, 0.7)",
      "--sc-mote": "#b9dde8",
      "--sc-mote-glow": "rgba(185, 221, 232, 0.45)",
      "--sc-glow-a": "rgba(232, 178, 92, 0.2)",
      "--sc-glow-b": "rgba(190, 140, 60, 0.08)",
      "--sc-mist": "rgba(170, 200, 220, 0.1)",
    },
    background:
      "radial-gradient(ellipse at 22% 112%, rgba(232, 178, 92, 0.16), transparent 42%), radial-gradient(ellipse at 78% -8%, rgba(150, 200, 230, 0.1), transparent 45%), radial-gradient(ellipse at center, #09131e 0%, #060d16 55%, #02050a 100%)",
    glyphs: ["✧", "⚜", "✦", "✵"],
  },
  {
    id: "deep-space",
    name: "Deep Space",
    vars: {
      "--sc-glyph": "#cfd8ff",
      "--sc-glyph-glow": "rgba(207, 216, 255, 0.8)",
      "--sc-mote": "#e6ddb8",
      "--sc-mote-glow": "rgba(230, 221, 184, 0.5)",
      "--sc-glow-a": "rgba(130, 150, 230, 0.16)",
      "--sc-glow-b": "rgba(90, 110, 200, 0.07)",
      "--sc-mist": "rgba(140, 150, 230, 0.08)",
    },
    background:
      "radial-gradient(ellipse at 30% 20%, rgba(120, 130, 220, 0.12), transparent 45%), radial-gradient(ellipse at 75% 70%, rgba(224, 190, 106, 0.07), transparent 40%), radial-gradient(ellipse at center, #0a0d1e 0%, #060814 55%, #020308 100%)",
    glyphs: ["✦", "✷", "☾", "✧"],
  },
];

export function isAmbienceId(value: unknown): value is string {
  return (
    typeof value === "string" && AMBIENCE_PRESETS.some((a) => a.id === value)
  );
}

export function ambienceById(
  id: string | undefined | null
): AmbiencePreset | null {
  return AMBIENCE_PRESETS.find((a) => a.id === id) ?? null;
}

/** Six-digit hex color, the only color format stored anywhere. */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Ids of images stored by us (journal_images / profile_images). */
export function isImageId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(value);
}
