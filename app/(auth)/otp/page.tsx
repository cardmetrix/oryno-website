"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * OTP now lives on /register (same Clerk SignUp instance).
 * Keep this route as a soft redirect for old links/bookmarks.
 */
export default function OtpPage() {
  const router = useRouter();

  useEffect(() => {
    const hasPending = Boolean(
      sessionStorage.getItem("oryno_pending_verify"),
    );
    router.replace(hasPending ? "/register?verify=1" : "/register");
  }, [router]);

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-background text-sm text-muted-foreground">
      Continuing verification…
    </div>
  );
}
