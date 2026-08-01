"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function AuthForm({
  mode,
  googleEnabled,
}: {
  mode: "login" | "signup";
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result =
      mode === "signup"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
  }

  return (
    <div className="panel-arcane w-full max-w-md p-8">
      <h1 className="font-display text-2xl text-center mb-1">
        {mode === "signup" ? "Begin Your Chronicle" : "Return to Your Tome"}
      </h1>
      <p className="text-center text-ink-dim text-sm mb-6">
        {mode === "signup"
          ? "Create an account to bind your journal."
          : "Sign in to open your journals."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="block text-sm mb-1 text-ink-dim">
              Name
            </label>
            <input
              id="name"
              className="input-arcane"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm mb-1 text-ink-dim">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input-arcane"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm mb-1 text-ink-dim">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input-arcane"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-arcane w-full" disabled={busy}>
          {busy
            ? "Working..."
            : mode === "signup"
              ? "Create Account"
              : "Sign In"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-void-border" />
            <span className="text-xs text-ink-dim">or</span>
            <div className="h-px flex-1 bg-void-border" />
          </div>
          <button type="button" className="btn-ghost w-full" onClick={handleGoogle}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
              />
            </svg>
            Continue with Google
          </button>
        </>
      )}

      <p className="text-center text-sm text-ink-dim mt-6">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-arcane-bright hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="text-arcane-bright hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
