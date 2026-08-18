import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import "./landing.css";

export const metadata: Metadata = {
  title: "Vellum — bind your adventures into living tomes",
  description:
    "Write, listen, and share TTRPG journals as beautifully bound tomes and audiobooks. A members-only archive with private-by-default sharing.",
};

/**
 * Public marketing page — the only thing a signed-out visitor sees besides
 * login/signup and share-link teasers. JetBrains-style dark gradient site
 * with animated CSS feature mockups (no binary assets to load).
 */
export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="ld-root">
      {/* Top nav */}
      <header className="ld-nav">
        <span className="ld-logo">
          Vellum
          <span className="ld-logo-by">by Arcadia</span>
        </span>
        <nav className="ld-nav-links">
          <Link href="/login" className="ld-btn ld-btn--ghost">
            Sign In
          </Link>
          <Link href="/signup" className="ld-btn ld-btn--primary">
            Join Free
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="ld-hero">
        <div className="ld-hero-glow" aria-hidden />
        <h1 className="ld-hero-title">
          Every chronicle.
          <br />
          <span className="ld-gradient-text">Beautifully bound.</span>
        </h1>
        <p className="ld-hero-sub">
          Vellum turns campaign journals into page-flipping ancient tomes and
          full audiobooks — kept in a members-only archive, shared only when
          you say so.
        </p>
        <div className="ld-hero-ctas">
          <Link href="/signup" className="ld-btn ld-btn--primary ld-btn--lg">
            Start Your Chronicle — Free
          </Link>
          <Link href="/login" className="ld-btn ld-btn--ghost ld-btn--lg">
            Return to Your Tome
          </Link>
        </div>

        {/* Hero mockup: a tome mid-flip */}
        <div className="ld-hero-mock" aria-hidden>
          <div className="ld-tome">
            <div className="ld-tome-page ld-tome-page--left">
              <span className="ld-line w80" />
              <span className="ld-line w95" />
              <span className="ld-line w70" />
              <span className="ld-line w90" />
              <span className="ld-line w60" />
              <span className="ld-line w85" />
            </div>
            <div className="ld-tome-flip" />
            <div className="ld-tome-page ld-tome-page--right">
              <span className="ld-line w90" />
              <span className="ld-line w75" />
              <span className="ld-line w95" />
              <span className="ld-line w65" />
              <span className="ld-line w80" />
              <span className="ld-line w50" />
            </div>
          </div>
        </div>
      </section>

      {/* For scribes */}
      <section className="ld-section">
        <p className="ld-kicker ld-kicker--violet">For scribes</p>
        <h2 className="ld-h2">Write once. Bind forever.</h2>
        <div className="ld-grid">
          <div className="ld-card">
            <div className="ld-card-mock" aria-hidden>
              <div className="ld-editor">
                <span className="ld-type-line" />
                <span className="ld-type-line ld-type-line--d1" />
                <span className="ld-type-line ld-type-line--d2" />
              </div>
            </div>
            <h3>Write &amp; Bind</h3>
            <p>
              Compose in the built-in editor, sync a Google Doc, or upload
              files. Your words become a tome with themed pages, covers, and
              chapter art.
            </p>
          </div>
          <div className="ld-card">
            <div className="ld-card-mock" aria-hidden>
              <div className="ld-player">
                <span className="ld-play">▶</span>
                <span className="ld-eq">
                  <i /><i /><i /><i /><i />
                </span>
                <span className="ld-progress" />
              </div>
            </div>
            <h3>Narrate It</h3>
            <p>
              Upload narration for a full audiobook: chapter art, playlists
              across volumes, and a player themed to your binding.
            </p>
          </div>
          <div className="ld-card">
            <div className="ld-card-mock" aria-hidden>
              <div className="ld-themes">
                <span className="ld-swatch s1" />
                <span className="ld-swatch s2" />
                <span className="ld-swatch s3" />
                <span className="ld-swatch s4" />
              </div>
            </div>
            <h3>Seven Bindings</h3>
            <p>
              From a witch&apos;s grimoire to a captain&apos;s log — hand-crafted
              themes style your pages, covers, and player. Or build your own.
            </p>
          </div>
        </div>
      </section>

      {/* For readers */}
      <section className="ld-section">
        <p className="ld-kicker ld-kicker--teal">For readers</p>
        <h2 className="ld-h2">A living archive, shelved by taste.</h2>
        <div className="ld-wide">
          <div className="ld-wide-copy">
            <p>
              Browse the community&apos;s books and audiobooks, filtered by
              genre, tags, and review verdicts. Shelve what you love, follow
              scribes, and pick up where you left off on any device.
            </p>
            <ul className="ld-ticks">
              <li>Review verdicts — from Mixed to Very Positive</li>
              <li>Personal shelves, playlists, and reading history</li>
              <li>Recommendations tuned to what you actually read</li>
            </ul>
          </div>
          <div className="ld-shelf" aria-hidden>
            <div className="ld-book b1"><span className="ld-badge">★ 4.8</span></div>
            <div className="ld-book b2"><span className="ld-badge">★ 4.6</span></div>
            <div className="ld-book b3"><span className="ld-badge">★ 4.9</span></div>
          </div>
        </div>
      </section>

      {/* For tables */}
      <section className="ld-section">
        <p className="ld-kicker ld-kicker--ember">For tables</p>
        <h2 className="ld-h2">Your party, between sessions.</h2>
        <div className="ld-wide ld-wide--reverse">
          <div className="ld-chat" aria-hidden>
            <div className="ld-msg m1">
              <i className="ld-avatar a1" />
              <span>Session recap is up — chapter twelve is bound.</span>
            </div>
            <div className="ld-msg m2">
              <i className="ld-avatar a2" />
              <span>The door heist chapter. Finally.</span>
            </div>
            <div className="ld-msg m3">
              <i className="ld-avatar a3" />
              <span>@everyone book club, Friday, the Hollow Lighthouse.</span>
            </div>
          </div>
          <div className="ld-wide-copy">
            <p>
              Groups with channels, ranks, and chat keep the table together —
              share works in-line, see who&apos;s reading what, and get a push
              when someone @mentions you.
            </p>
            <ul className="ld-ticks">
              <li>Discord-style groups with reading presence</li>
              <li>Friends, follows, and release alerts</li>
              <li>Device notifications for mentions and invites</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Privacy band */}
      <section className="ld-band">
        <h2 className="ld-h2">Private by default. Shared on purpose.</h2>
        <p>
          The archive is members-only — nothing you bind faces the open
          street. Hand out revocable share links when you want outside eyes,
          and the link follows the work: set a tome private and the link goes
          private with it.
        </p>
      </section>

      {/* Stats */}
      <section className="ld-stats">
        <div>
          <span className="ld-stat-n">~1 min</span>
          <span className="ld-stat-l">to bind your first tome</span>
        </div>
        <div>
          <span className="ld-stat-n">7</span>
          <span className="ld-stat-l">hand-crafted bindings</span>
        </div>
        <div>
          <span className="ld-stat-n">100 MB</span>
          <span className="ld-stat-l">audio chapters, per track</span>
        </div>
        <div>
          <span className="ld-stat-n">0</span>
          <span className="ld-stat-l">ads, forever</span>
        </div>
      </section>

      {/* Final CTA */}
      <section className="ld-cta">
        <h2 className="ld-h2">The shelves are waiting.</h2>
        <p>Free to join. Your first tome takes about a minute to bind.</p>
        <Link href="/signup" className="ld-btn ld-btn--primary ld-btn--lg">
          Create Your Library
        </Link>
      </section>

      <footer className="ld-footer">
        <span>Vellum — write, listen, and share your chronicles.</span>
        <span>© 2026 Arcadia</span>
      </footer>
    </main>
  );
}
