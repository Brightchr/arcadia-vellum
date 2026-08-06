import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/nav/AppShell";
import {
  BookOpenIcon,
  HeadphonesIcon,
  PenIcon,
  RepeatIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Vellum — bind your adventures into living tomes",
  description:
    "Write, listen, and share TTRPG journals as beautifully bound tomes and audiobooks. Discover community chronicles, follow your favorite scribes, and build your own arcane library.",
};

const FEATURES = [
  {
    icon: <PenIcon className="h-6 w-6" />,
    title: "Write & Bind",
    body: "Compose in the built-in editor, link a Google Doc, or upload files — your words are bound into an ancient tome with themed pages, covers, and chapter art.",
  },
  {
    icon: <HeadphonesIcon className="h-6 w-6" />,
    title: "Audiobooks",
    body: "Upload narration and get a full audiobook experience: chapter images, playlists across volumes, repeat modes, and a player themed to your binding.",
  },
  {
    icon: <BookOpenIcon className="h-6 w-6" />,
    title: "Discover",
    body: "Browse public books and audiobooks from the community — search by title, author, or tags, and leave star reviews on the works you love.",
  },
  {
    icon: <RepeatIcon className="h-6 w-6" />,
    title: "Share & Follow",
    body: "Build a profile that showcases your works, follow fellow scribes, add friends, and save favorites to your own shelf — with privacy controls throughout.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="arcane-bg min-h-screen">
      <AppShell user={null}>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mark.png"
          alt=""
          width={120}
          height={120}
          className="mx-auto mb-6 h-30 w-30"
        />
        <h1 className="font-display text-4xl sm:text-5xl text-arcane-bright leading-tight">
          Your adventures, bound into living tomes
        </h1>
        <p className="text-ink-dim text-lg max-w-2xl mx-auto mt-4">
          Vellum turns campaign journals, session diaries, and epic
          chronicles into beautifully bound books and audiobooks — then gives
          them a realm of readers.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Link href="/signup" className="btn-arcane !px-6 !py-3 !text-base">
            Start Your Chronicle — Free
          </Link>
          <Link href="/browse" className="btn-ghost !px-6 !py-3 !text-base">
            Browse the Archives
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel-arcane p-6">
              <div className="text-arcane-bright mb-3">{f.icon}</div>
              <h2 className="font-heading text-lg mb-2">{f.title}</h2>
              <p className="text-sm text-ink-dim leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="font-display text-2xl text-arcane-bright text-center mb-8">
          How the binding works
        </h2>
        <ol className="grid gap-5 sm:grid-cols-3">
          {[
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
              body: "Keep it private, share a link, or publish to the archives where readers can save, review, and follow your work.",
            },
          ].map((s) => (
            <li key={s.step} className="panel-arcane p-6 text-center">
              <p className="font-display text-3xl text-arcane-bright mb-2">
                {s.step}
              </p>
              <h3 className="font-heading text-base mb-2">{s.title}</h3>
              <p className="text-sm text-ink-dim">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-void-border">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-arcane-bright mb-3">
            The shelves are waiting.
          </h2>
          <p className="text-ink-dim mb-6">
            Free to join. Your first tome takes about a minute to bind.
          </p>
          <Link href="/signup" className="btn-arcane !px-6 !py-3 !text-base">
            Create Your Library
          </Link>
          <p className="text-xs text-ink-dim mt-10">
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
