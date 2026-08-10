/**
 * Pure custom-theme logic — config validation and CSS generation. No DB
 * imports, so the theme builder can run the exact same code in the browser
 * for its live preview. Server-side helpers live in custom-themes.ts.
 */
import {
  ambienceById,
  fontCss,
  isAmbienceId,
  isFontId,
  isHexColor,
  isImageId,
  isOrnament,
  isTextureId,
  textureById,
} from "@/lib/theme-assets";

/**
 * Everything a user-built theme is made of. Every field is validated
 * against a whitelist or strict format before it is stored or rendered —
 * config values are interpolated into CSS, so nothing free-form gets in.
 */
export interface CustomThemeConfig {
  // Pages
  pageBg: string;
  ink: string;
  accent: string;
  accent2: string;
  headingFont: string;
  bodyFont: string;
  pageTexture: string;
  /** Uploaded tiling texture (profile_images id) — overrides pageTexture. */
  pageTextureImageId?: string | null;
  // Cover / binding
  coverBg: string;
  coverInk: string;
  coverFont: string;
  coverTexture: string;
  coverTextureImageId?: string | null;
  /** Chapter/cover flourish glyph. */
  ornament: string;
  /** Which of the built-in scene animations plays behind the book. */
  ambience: string;
}

/** A fresh theme starts as a readable parchment-and-violet base. */
export const STARTER_THEME_CONFIG: CustomThemeConfig = {
  pageBg: "#d8d2c0",
  ink: "#2a2420",
  accent: "#5a3a72",
  accent2: "#3f5e5c",
  headingFont: "fell",
  bodyFont: "garamond",
  pageTexture: "laid",
  coverBg: "#221a2e",
  coverInk: "#b9a3d6",
  coverFont: "fell",
  coverTexture: "grain",
  ornament: "✦",
  ambience: "witchfire",
};

export function parseThemeConfig(raw: unknown): CustomThemeConfig | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) return null;
  const c = value as Record<string, unknown>;
  const config: CustomThemeConfig = { ...STARTER_THEME_CONFIG };

  const colors = [
    "pageBg",
    "ink",
    "accent",
    "accent2",
    "coverBg",
    "coverInk",
  ] as const;
  for (const key of colors) {
    const value = c[key];
    if (isHexColor(value)) config[key] = value;
  }
  if (isFontId(c.headingFont)) config.headingFont = c.headingFont;
  if (isFontId(c.bodyFont)) config.bodyFont = c.bodyFont;
  if (isFontId(c.coverFont)) config.coverFont = c.coverFont;
  if (isTextureId(c.pageTexture)) config.pageTexture = c.pageTexture;
  if (isTextureId(c.coverTexture)) config.coverTexture = c.coverTexture;
  config.pageTextureImageId = isImageId(c.pageTextureImageId)
    ? c.pageTextureImageId
    : null;
  config.coverTextureImageId = isImageId(c.coverTextureImageId)
    ? c.coverTextureImageId
    : null;
  if (isOrnament(c.ornament)) config.ornament = c.ornament;
  if (isAmbienceId(c.ambience)) config.ambience = c.ambience;
  return config;
}

/** journals.theme value for a custom theme row. */
export function customThemeValue(id: string): string {
  return `custom-${id}`;
}

export function customThemeIdFromValue(theme: string): string | null {
  return theme.startsWith("custom-") ? theme.slice("custom-".length) : null;
}

function textureLayers(
  presetId: string,
  imageId: string | null | undefined
): { layers: string[]; sizes: string[]; positions: string[] } {
  if (imageId) {
    return {
      layers: [`url("/api/avatars/${imageId}")`],
      sizes: ["min(280px, 45%) auto"],
      positions: ["0 0"],
    };
  }
  const preset = textureById(presetId);
  if (!preset?.layers) return { layers: [], sizes: [], positions: [] };
  const layers = splitLayers(preset.layers);
  return {
    layers,
    sizes: preset.sizes
      ? splitLayers(preset.sizes)
      : Array(layers.length).fill("auto"),
    positions: preset.positions
      ? splitLayers(preset.positions)
      : Array(layers.length).fill("0 0"),
  };
}

/** Splits a CSS layer list on top-level commas only. */
function splitLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      layers.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) layers.push(current.trim());
  return layers;
}

/**
 * Generates the CSS that makes a custom theme render through the exact same
 * variables the built-in themes use — pages, cover, reader chrome, and the
 * chosen ambience scene. `className` must be a generated class (no user
 * input), and `config` must have passed parseThemeConfig.
 */
export function customThemeCss(
  className: string,
  config: CustomThemeConfig
): string {
  const page = textureLayers(config.pageTexture, config.pageTextureImageId);
  const cover = textureLayers(config.coverTexture, config.coverTextureImageId);
  const headingFont = fontCss(config.headingFont) ?? "serif";
  const bodyFont = fontCss(config.bodyFont) ?? "serif";
  const coverFont = fontCss(config.coverFont) ?? "serif";
  const ambience = ambienceById(config.ambience);

  const pageBgLayers = [
    ...page.layers,
    `radial-gradient(ellipse at 55% 45%, rgba(255, 253, 245, 0.16), transparent 62%)`,
    `linear-gradient(160deg, color-mix(in srgb, ${config.pageBg} 90%, white) 0%, ${config.pageBg} 50%, color-mix(in srgb, ${config.pageBg} 80%, black) 100%)`,
  ].join(", ");
  const pageSizes = [...page.sizes, "auto", "auto"].join(", ");
  const pagePositions = [...page.positions, "0 0", "0 0"].join(", ");

  const coverBgLayers = [
    ...cover.layers,
    `radial-gradient(ellipse at 42% 24%, color-mix(in srgb, ${config.accent} 30%, transparent), transparent 55%)`,
    `radial-gradient(ellipse at 68% 82%, color-mix(in srgb, ${config.accent2} 22%, transparent), transparent 52%)`,
    `linear-gradient(150deg, color-mix(in srgb, ${config.coverBg} 86%, white) 0%, ${config.coverBg} 55%, color-mix(in srgb, ${config.coverBg} 62%, black) 100%)`,
  ].join(", ");
  const coverSizes = [...cover.sizes, "auto", "auto", "auto"].join(", ");
  const coverPositions = [...cover.positions, "0 0", "0 0", "0 0"].join(", ");

  const rules = [
    `.${className} {
  --tome-page-bg-color: ${config.pageBg};
  --tome-page-bg: ${pageBgLayers};
  --tome-ink: ${config.ink};
  --tome-accent: ${config.accent};
  --tome-accent-2: ${config.accent2};
  --tome-heading-font: ${headingFont};
  --tome-body-font: ${bodyFont};
  --tome-body-size: 1.05rem;
  --tome-body-line: 1.55;
  --tome-cover-bg: ${coverBgLayers};
  --tome-cover-ink: ${config.coverInk};
  --tome-cover-border: color-mix(in srgb, ${config.coverInk} 52%, transparent);
  --tome-img-filter: saturate(0.9);
  --tome-vignette: color-mix(in srgb, ${config.ink} 38%, transparent);
  --tome-cover-font: ${coverFont};
  --tome-ornament: "${config.ornament}";
  --tome-cover-ornament: "${config.ornament} ${config.ornament} ${config.ornament}";
}`,
    `.${className} .tome-page { background-size: ${pageSizes}; background-position: ${pagePositions}; }`,
    `.${className} .tome-cover, .${className} .tome-endpaper { background-size: ${coverSizes}; background-position: ${coverPositions}; }`,
  ];

  if (ambience) {
    const vars = Object.entries(ambience.vars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");
    rules.push(
      `.${className}.tome-scene { ${vars} background: ${ambience.background}; }`
    );
    ambience.glyphs.forEach((glyph, i) => {
      const nth = i === 3 ? "4n" : `4n + ${i + 1}`;
      rules.push(
        `.${className} .tome-ambience-rune:nth-of-type(${nth})::after { content: "${glyph}"; }`
      );
    });
  }

  return rules.join("\n");
}
