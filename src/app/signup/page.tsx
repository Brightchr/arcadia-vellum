import { redirect } from "next/navigation";
import { getSession, googleConfigured } from "@/lib/auth";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="arcane-bg min-h-screen flex items-center justify-center p-4">
      <AuthForm mode="signup" googleEnabled={googleConfigured} />
    </main>
  );
}
