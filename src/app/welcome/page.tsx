import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { sessionWithNav } from "@/lib/nav";
import { suggestUsername } from "@/lib/profile";
import { appThemeClass } from "@/lib/themes";
import { WelcomeForm } from "@/components/social/WelcomeForm";

export const metadata: Metadata = {
  title: "Welcome — Arcadia Vellum",
};

export default async function WelcomePage() {
  const { session, navUser } = await sessionWithNav();
  if (!session) redirect("/login");
  if (navUser?.username) redirect("/dashboard");

  const suggestion = await suggestUsername(session.user.name);

  return (
    <main
      className={`${appThemeClass(navUser?.dashboardTheme ?? "")} arcane-bg min-h-screen grid place-items-center p-6`}
    >
      <div className="panel-arcane w-full max-w-md p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mark.png"
          alt=""
          width={72}
          height={72}
          className="mx-auto mb-4 h-18 w-18"
        />
        <h1 className="font-display text-2xl text-center mb-1">
          Choose Your Scribe Name
        </h1>
        <p className="text-center text-ink-dim text-sm mb-6">
          One last step, {session.user.name.split(" ")[0]} — pick the username
          the realm will know you by. You can change it later in Settings.
        </p>
        <WelcomeForm suggestion={suggestion} />
      </div>
    </main>
  );
}
