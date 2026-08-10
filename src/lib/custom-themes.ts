import { db } from "@/db";
import { journals, userThemes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { newId } from "@/lib/id";
import { DEFAULT_THEME, isThemeId } from "@/lib/themes";
import {
  customThemeCss,
  customThemeIdFromValue,
  customThemeValue,
  parseThemeConfig,
  type CustomThemeConfig,
} from "@/lib/theme-css";

export {
  customThemeCss,
  customThemeIdFromValue,
  customThemeValue,
  parseThemeConfig,
  STARTER_THEME_CONFIG,
} from "@/lib/theme-css";
export type { CustomThemeConfig } from "@/lib/theme-css";

export type UserTheme = typeof userThemes.$inferSelect;

export const MAX_THEMES_PER_USER = 20;

export async function listThemesForOwner(ownerId: string) {
  return db
    .select()
    .from(userThemes)
    .where(eq(userThemes.ownerId, ownerId))
    .orderBy(userThemes.createdAt);
}

export async function getUserTheme(id: string) {
  const rows = await db.select().from(userThemes).where(eq(userThemes.id, id));
  return rows[0] ?? null;
}

export async function getOwnedTheme(id: string, ownerId: string) {
  const rows = await db
    .select()
    .from(userThemes)
    .where(and(eq(userThemes.id, id), eq(userThemes.ownerId, ownerId)));
  return rows[0] ?? null;
}

export async function createUserTheme(
  ownerId: string,
  name: string,
  config: CustomThemeConfig
) {
  const [row] = await db
    .insert(userThemes)
    .values({
      id: newId(),
      ownerId,
      name: name.slice(0, 60),
      config: JSON.stringify(config),
    })
    .returning();
  return row;
}

export async function updateUserTheme(
  id: string,
  patch: { name?: string; config?: CustomThemeConfig }
) {
  const [row] = await db
    .update(userThemes)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.slice(0, 60) } : {}),
      ...(patch.config !== undefined
        ? { config: JSON.stringify(patch.config) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(userThemes.id, id))
    .returning();
  return row ?? null;
}

/** Deletes a theme; journals wearing it fall back to the default theme. */
export async function deleteUserTheme(id: string) {
  await db
    .update(journals)
    .set({ theme: DEFAULT_THEME })
    .where(eq(journals.theme, customThemeValue(id)));
  await db.delete(userThemes).where(eq(userThemes.id, id));
}

/** True when the value names a built-in theme or a theme this user owns. */
export async function isValidThemeForUser(
  value: string,
  userId: string
): Promise<boolean> {
  if (isThemeId(value)) return true;
  const id = customThemeIdFromValue(value);
  if (!id) return false;
  return (await getOwnedTheme(id, userId)) !== null;
}

export interface ResolvedTheme {
  /** The class to put on the page container (theme-<id> or theme-custom-<id>). */
  className: string;
  /** Generated CSS to inject for custom themes; null for built-ins. */
  css: string | null;
}

/**
 * Turns a journal's stored theme value into a renderable class + CSS.
 * A dangling custom reference (deleted theme) falls back to the default.
 */
export async function resolveTheme(theme: string): Promise<ResolvedTheme> {
  const customId = customThemeIdFromValue(theme);
  if (!customId) {
    return {
      className: `theme-${isThemeId(theme) ? theme : DEFAULT_THEME}`,
      css: null,
    };
  }
  const row = await getUserTheme(customId);
  const config = row ? parseThemeConfig(row.config) : null;
  if (!config) return { className: `theme-${DEFAULT_THEME}`, css: null };
  const className = `theme-custom-${customId}`;
  return { className, css: customThemeCss(className, config) };
}
