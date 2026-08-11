import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AuthSessionSync } from "@/components/auth/auth-session-sync";
import { CrispChatBoot } from "@/components/app/crisp-chat";
import { CountryProvider } from "@/components/providers/country-provider";
import { ensureAppUser } from "@/lib/auth/current-user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  let user;
  try {
    user = await ensureAppUser();
  } catch (error) {
    console.error("[app-layout] sync failed", error);
    redirect("/login?error=sync_failed");
  }

  if (!user) {
    redirect("/login");
  }

  if (user.status === "suspended" || user.status === "deleted") {
    redirect("/login?error=account_disabled");
  }

  return (
    <CountryProvider>
      <AuthSessionSync />
      <CrispChatBoot />
      {children}
    </CountryProvider>
  );
}
