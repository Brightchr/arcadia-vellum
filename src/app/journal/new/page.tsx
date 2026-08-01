import { redirect } from "next/navigation";
import { getSession, googleConfigured } from "@/lib/auth";
import { appThemeClass } from "@/lib/themes";
import { NewJournalWizard } from "@/components/wizard/NewJournalWizard";

export default async function NewJournalPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const theme = (session.user as { dashboardTheme?: string }).dashboardTheme;

  return (
    <main
      className={`${appThemeClass(theme)} arcane-bg min-h-screen flex items-start justify-center p-4 py-12`}
    >
      <NewJournalWizard googleEnabled={googleConfigured} />
    </main>
  );
}
