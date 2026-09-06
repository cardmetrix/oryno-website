import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AuthSessionSync } from "@/components/auth/auth-session-sync";
import { CrispChatBoot } from "@/components/app/crisp-chat";
import { CountryProvider } from "@/components/providers/country-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ensureAppUser } from "@/lib/auth/current-user";
import { twoFactorStatus } from "@/lib/security/totp-auth";

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

  const twoFa = await twoFactorStatus({ userId: user.id });
  if (twoFa.required && !twoFa.verified) {
    redirect("/verify-2fa");
  }

  return (
    <QueryProvider>
      <CountryProvider>
        <AuthSessionSync />
        <CrispChatBoot />
        {children}
      </CountryProvider>
    </QueryProvider>
  );
}
