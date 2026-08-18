import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, googleConfigured } from "@/lib/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import "../landing.css";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    // ld-root paints the landing's nebula shell; app-theme-darkstar feeds the
    // same palette into the form's panel/input/button classes.
    <main className="ld-root app-theme-darkstar ld-auth">
      <header className="ld-nav">
        <Link href="/" className="ld-logo">
          Vellum
          <span className="ld-logo-by">by Arcadia</span>
        </Link>
        <nav className="ld-nav-links">
          <Link href="/login" className="ld-btn ld-btn--ghost">
            Sign In
          </Link>
        </nav>
      </header>
      <div className="ld-auth-stage">
        <div className="ld-hero-glow" aria-hidden />
        <AuthForm mode="signup" googleEnabled={googleConfigured} />
      </div>
    </main>
  );
}
