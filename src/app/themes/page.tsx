import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { appThemeClass } from "@/lib/themes";
import { listThemesForOwner } from "@/lib/custom-themes";
import { ThemeBuilder } from "@/components/themes/ThemeBuilder";
import { ArrowLeftIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Theme Builder — Vellum",
};

/** Build-your-own binding: colors, fonts, textures, and ambience. */
export default async function ThemeBuilderPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const themes = await listThemesForOwner(session.user.id);
  const theme = (session.user as { dashboardTheme?: string }).dashboardTheme;

  return (
    <main className={`${appThemeClass(theme)} arcane-bg min-h-screen`}>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10">
        <header className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-ink-dim hover:text-arcane-bright"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" /> Library
          </Link>
          <h1 className="font-display text-2xl mt-1">Theme Builder</h1>
          <p className="text-sm text-ink-dim mt-1">
            Bind your own theme — colors, fonts, textures, and ambience. Pick
            it for any tome from its settings, under Theme.
          </p>
        </header>
        <ThemeBuilder
          initialThemes={themes.map((t) => ({
            id: t.id,
            name: t.name,
            config: t.config,
          }))}
        />
      </div>
    </main>
  );
}
