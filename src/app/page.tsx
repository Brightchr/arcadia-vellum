import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import "./landing.css";

export const metadata: Metadata = {
  title: "Vellum | Bind your adventures into books",
  description:
    "Turn your TTRPG campaign journals into beautiful books and audiobooks, then share them with your table or keep them just for you.",
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
          Your adventures,
          <br />
          <span className="ld-gradient-text">beautifully bound.</span>
        </h1>
        <p className="ld-hero-sub">
          Vellum turns your campaign journals into page-flipping books and
          audiobooks. Everything lives in a private library for members, and
          you choose exactly who else gets a link.
        </p>
        <div className="ld-hero-ctas">
          <Link href="/signup" className="ld-btn ld-btn--primary ld-btn--lg">
            Create Your Free Library
          </Link>
          <Link href="/login" className="ld-btn ld-btn--ghost ld-btn--lg">
            Sign In
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
        <p className="ld-kicker ld-kicker--violet">For writers</p>
        <h2 className="ld-h2">Write it once. Keep it forever.</h2>
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
              Write in the built-in editor, link a Google Doc, or upload a
              file. Vellum lays your words onto themed pages with covers and
              chapter art, like a real book.
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
              Upload your own narration and any journal becomes an audiobook,
              with chapter art, playlists, and a player styled to match your
              book.
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
            <h3>Eight Bindings</h3>
            <p>
              Pick from eight hand-made book styles, from a witch&apos;s
              grimoire to the Darkstar night sky. Or build a style of your
              own.
            </p>
          </div>
        </div>
      </section>

      {/* For readers */}
      <section className="ld-section">
        <p className="ld-kicker ld-kicker--teal">For readers</p>
        <h2 className="ld-h2">Find your next favorite story.</h2>
        <div className="ld-wide">
          <div className="ld-wide-copy">
            <p>
              Browse books and audiobooks written by other players. Filter by
              genre, tags, and review scores, save the ones you love, and pick
              up right where you left off on any device.
            </p>
            <ul className="ld-ticks">
              <li>Review scores from Mixed to Very Positive</li>
              <li>Personal shelves, playlists, and reading history</li>
              <li>Recommendations based on what you actually read</li>
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
        <p className="ld-kicker ld-kicker--ember">For your table</p>
        <h2 className="ld-h2">Keep the party together between sessions.</h2>
        <div className="ld-wide ld-wide--reverse">
          <div className="ld-chat" aria-hidden>
            <div className="ld-msg m1">
              <i className="ld-avatar a1" />
              <span>Session recap is up, chapter twelve is bound.</span>
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
              Every table gets its own group with channels, chat, and member
              ranks. Share your books right in the conversation, see what your
              friends are reading, and get a notification when someone
              mentions you.
            </p>
            <ul className="ld-ticks">
              <li>Groups with channels and chat, like Discord</li>
              <li>Friends, follows, and new release alerts</li>
              <li>Notifications on your devices for mentions and invites</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Privacy band */}
      <section className="ld-band">
        <h2 className="ld-h2">Your writing stays private.</h2>
        <p>
          Only members can see the library, and nothing you make is shared
          unless you choose to share it. Want to show a friend who has no
          account? Send them a private link. If you make the book private
          again, the link stops working too.
        </p>
      </section>

      {/* Stats */}
      <section className="ld-stats">
        <div>
          <span className="ld-stat-n">1 min</span>
          <span className="ld-stat-l">to bind your first book</span>
        </div>
        <div>
          <span className="ld-stat-n">8</span>
          <span className="ld-stat-l">hand-made book styles</span>
        </div>
        <div>
          <span className="ld-stat-n">100 MB</span>
          <span className="ld-stat-l">per audio chapter</span>
        </div>
        <div>
          <span className="ld-stat-n">0</span>
          <span className="ld-stat-l">ads, ever</span>
        </div>
      </section>

      {/* Final CTA */}
      <section className="ld-cta">
        <h2 className="ld-h2">Ready to bind your first book?</h2>
        <p>It&apos;s free, and it takes about a minute.</p>
        <Link href="/signup" className="ld-btn ld-btn--primary ld-btn--lg">
          Create Your Library
        </Link>
      </section>

      <footer className="ld-footer">
        <span>Vellum. Write, listen, and share your stories.</span>
        <span>© 2026 Arcadia</span>
      </footer>
    </main>
  );
}
