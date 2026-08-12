import { existsSync } from "fs";
import path from "path";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/nav/AppShell";
import { TomeAmbience } from "@/components/book/TomeAmbience";
import {
  BookOpenIcon,
  HeadphonesIcon,
  PenIcon,
  CompassIcon,
  UsersIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Vellum — bind your adventures into living tomes",
  description:
    "Write, listen, and share TTRPG journals as beautifully bound tomes and audiobooks. Discover community chronicles, follow your favorite scribes, and build your own arcane library.",
};

/**
 * Feature cards show artwork when you drop an image into /public/landing —
 * e.g. write.png, listen.png, discover.png, share.png, showcase.png.
 * Missing images fall back to a themed placeholder, so add them any time.
 */
function landingImage(name: string): string | null {
  return existsSync(path.join(process.cwd(), "public", "landing", name))
    ? `/landing/${name}`
    : null;
}

const FEATURES = [
  {
    icon: <PenIcon className="h-5 w-5" />,
    image: "write.png",
    title: "Write & Bind",
    body: "Compose in the built-in editor, link a Google Doc, or upload files — your words become an ancient tome with themed pages, covers, and chapter art.",
  },
  {
    icon: <HeadphonesIcon className="h-5 w-5" />,
    image: "listen.png",
    title: "Audiobooks",
    body: "Upload narration for a full audiobook experience: chapter art, playlists across volumes, repeat modes, and a player themed to your binding.",
  },
  {
    icon: <CompassIcon className="h-5 w-5" />,
    image: "discover.png",
    title: "Discover",
    body: "Browse the community's books and audiobooks — search by title, author, or tags, filter by review verdicts, and shelve the works you love.",
  },
  {
    icon: <UsersIcon className="h-5 w-5" />,
    image: "share.png",
    title: "Share & Follow",
    body: "Follow scribes, add friends, and share private tomes with revocable links. Your profile showcases your works, playlists, and shelves.",
  },
];

const STEPS = [
  {
    step: "I",
    title: "Bring your words or your voice",
    body: "Write in the app, sync a Google Doc, upload .docx/.md files, or add narration audio for a pure audiobook.",
  },
  {
    step: "II",
    title: "Choose a binding",
    body: "Five hand-crafted themes — from a witch's grimoire to a captain's log — style your pages, covers, and player.",
  },
  {
    step: "III",
    title: "Share the tome",
    body: "Keep it private, hand out revocable share links, or publish to the archives where readers save, review, and follow your work.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const showcase = landingImage("showcase.png");

  return (
    <main className="app-theme-witch-grimoire arcane-bg min-h-screen">
      <AppShell user={null}>
        {/* Hero — witch-grimoire ambience drifting behind the pitch */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="theme-witch-grimoire tome-scene absolute inset-0 pointer-events-none"
          >
            <TomeAmbience />
          </div>
          <div className="relative max-w-5xl mx-auto px-6 pt-16 sm:pt-20 pb-16 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mark.png"
              alt=""
              width={120}
              height={120}
              className="mx-auto mb-6 h-24 w-24 sm:h-30 sm:w-30 drop-shadow-[0_0_35px_rgba(157,123,216,0.45)]"
            />
            <h1 className="font-display text-4xl sm:text-6xl text-arcane-bright leading-tight">
              Your adventures, bound into living tomes
            </h1>
            <p className="text-ink-dim text-lg max-w-2xl mx-auto mt-5">
              Vellum turns campaign journals, session diaries, and epic
              chronicles into beautifully bound books and audiobooks — then
              gives them a realm of readers.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
              <Link href="/signup" className="btn-arcane !px-7 !py-3 !text-base">
                Start Your Chronicle — Free
              </Link>
              <Link href="/browse" className="btn-ghost !px-7 !py-3 !text-base">
                Browse the Archives
              </Link>
            </div>
          </div>
        </section>

        {/* Feature cards — drop art into /public/landing to fill the tops */}
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => {
              const img = landingImage(f.image);
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-edge bg-overlay backdrop-blur overflow-hidden hover:border-arcane/60 hover:-translate-y-1 transition-all duration-200 shadow-lg shadow-black/30"
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt=""
                      className="aspect-video w-full object-cover border-b border-edge"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="aspect-video w-full border-b border-edge bg-gradient-to-br from-arcane/25 via-void-raised to-ember/10 grid place-items-center text-arcane-bright/70 group-hover:text-arcane-bright transition-colors"
                    >
                      <span className="[&>svg]:h-9 [&>svg]:w-9">{f.icon}</span>
                    </div>
                  )}
                  <div className="p-5">
                    <h2 className="font-heading text-lg mb-1.5 inline-flex items-center gap-2 text-arcane-bright">
                      {f.icon}
                      {f.title}
                    </h2>
                    <p className="text-sm text-ink-dim leading-relaxed">
                      {f.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Optional wide showcase panel — appears when showcase.png exists */}
        {showcase && (
          <section className="max-w-5xl mx-auto px-6 pb-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={showcase}
              alt="Vellum in action"
              className="w-full rounded-2xl border border-edge shadow-2xl shadow-black/50"
            />
          </section>
        )}

        {/* How it works */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <h2 className="font-display text-2xl sm:text-3xl text-arcane-bright text-center mb-10">
            How the binding works
          </h2>
          <ol className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.step}
                className="relative rounded-2xl border border-edge bg-overlay backdrop-blur p-6 text-center"
              >
                <p className="font-display text-4xl text-arcane/60 mb-3">
                  {s.step}
                </p>
                <h3 className="font-heading text-base mb-2 text-ink">
                  {s.title}
                </h3>
                <p className="text-sm text-ink-dim">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-edge">
          <div className="max-w-5xl mx-auto px-6 py-16 text-center">
            <h2 className="font-display text-2xl sm:text-3xl text-arcane-bright mb-3">
              The shelves are waiting.
            </h2>
            <p className="text-ink-dim mb-7">
              Free to join. Your first tome takes about a minute to bind.
            </p>
            <Link href="/signup" className="btn-arcane !px-7 !py-3 !text-base">
              Create Your Library
            </Link>
            <p className="text-xs text-ink-dim mt-10 inline-flex items-center gap-2 justify-center w-full">
              <BookOpenIcon className="h-3.5 w-3.5" />
              Vellum — write, listen, and share your chronicles.
            </p>
            <p className="text-[11px] text-ink-dim/70 mt-1">
              © {new Date().getFullYear()} Arcadia
            </p>
          </div>
        </section>
      </AppShell>
    </main>
  );
}
