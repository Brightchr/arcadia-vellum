import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { sessionWithNav } from "@/lib/nav";
import { listSaved } from "@/lib/saves";
import { listPublicWorks } from "@/lib/discovery";
import { appThemeClass } from "@/lib/themes";
import { AppNav } from "@/components/nav/AppNav";
import { WorkCard } from "@/components/discover/WorkCard";

export const metadata: Metadata = {
  title: "Saved — Arcadia Vellum",
};

export default async function SavedPage() {
  const { session, navUser } = await sessionWithNav();
  if (!session || !navUser) redirect("/login");

  const saved = await listSaved(session.user.id);
  const savedKeys = new Set(saved.map((s) => `${s.kind}:${s.id}`));
  const works = (await listPublicWorks()).filter((w) =>
    savedKeys.has(`${w.kind}:${w.id}`)
  );
  // Keep the user's save order (newest first).
  const order = new Map(saved.map((s, i) => [`${s.kind}:${s.id}`, i]));
  works.sort(
    (a, b) =>
      (order.get(`${a.kind}:${a.id}`) ?? 0) -
      (order.get(`${b.kind}:${b.id}`) ?? 0)
  );

  return (
    <main
      className={`${appThemeClass(navUser.dashboardTheme ?? "")} arcane-bg min-h-screen`}
    >
      <AppNav user={navUser} active="saved" />
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-10">
        <header className="mb-8">
          <h1 className="font-display text-2xl text-arcane-bright">
            Saved Works
          </h1>
          <p className="text-sm text-ink-dim">
            Books and audiobooks you&apos;ve shelved from around Arcadia Vellum.
          </p>
        </header>

        {works.length === 0 ? (
          <div className="panel-arcane p-12 text-center">
            <p className="font-heading text-xl mb-2">Nothing saved yet.</p>
            <p className="text-ink-dim mb-6">
              Find something worth keeping on the browse page — the save button
              puts it here.
            </p>
            <Link href="/browse" className="btn-arcane">
              Browse the Archives
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-5 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {works.map((w) => (
              <WorkCard key={`${w.kind}:${w.id}`} work={w} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
