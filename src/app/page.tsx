import Link from "next/link";
import { getSession } from "@/lib/auth";
import { THEMES } from "@/lib/themes";
import { ThemePreview } from "@/components/wizard/ThemePreview";
import TomeReader from "@/components/book/TomeReaderClient";
import {
  DEMO_JOURNAL_HTML,
  DEMO_TITLE,
  DEMO_CHARACTER,
} from "@/lib/demo-content";

export default async function LandingPage() {
  const session = await getSession();

  return (
    <main className="arcane-bg min-h-screen">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <h1 className="font-display text-5xl md:text-6xl mb-4 text-arcane-bright">
          Arcadia Vellum
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-ink-dim mb-8">
          Your adventure journal, bound as an ancient tome. Feed it from a
          Google Doc or an upload, choose a binding, and flip through your
          story — then share it with your table.
        </p>
        <div className="flex justify-center gap-4">
          {session ? (
            <Link href="/dashboard" className="btn-arcane">
              Open My Journals
            </Link>
          ) : (
            <>
              <Link href="/signup" className="btn-arcane">
                Begin Your Chronicle
              </Link>
              <Link href="/login" className="btn-ghost">
                Sign In
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Live demo tome */}
      <section className="px-4 pb-16">
        <p className="text-center text-sm text-ink-dim mb-3 font-heading tracking-widest uppercase">
          Try the pages — drag a corner or use the arrows
        </p>
        <div className="h-[75vh] min-h-[420px] max-w-6xl mx-auto">
          <TomeReader
            html={DEMO_JOURNAL_HTML}
            theme="witch-grimoire"
            title={DEMO_TITLE}
            characterName={DEMO_CHARACTER}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "1 · Write anywhere",
              body: "Keep your journal in Google Docs — or bring a .docx, Markdown, or plain-text file.",
            },
            {
              title: "2 · Bind it",
              body: "Link the doc (you choose exactly which one we can read) and pick one of five bindings.",
            },
            {
              title: "3 · Share the tome",
              body: "Your journal becomes a page-flipping book with its own link. Resync any time you write more.",
            },
          ].map((f) => (
            <div key={f.title} className="panel-arcane p-6">
              <h3 className="font-heading text-arcane-bright mb-2">{f.title}</h3>
              <p className="text-sm text-ink-dim">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Themes */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="font-display text-2xl text-center mb-6">
          Five Bindings
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {THEMES.map((t) => (
            <div key={t.id} className="panel-arcane p-3">
              <ThemePreview themeId={t.id} />
              <p className="font-heading text-sm mt-3">{t.name}</p>
              <p className="text-xs text-ink-dim">{t.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-void-border py-6 text-center text-xs text-ink-dim">
        Arcadia Vellum — for tables, tomes, and the stories between them.
      </footer>
    </main>
  );
}
