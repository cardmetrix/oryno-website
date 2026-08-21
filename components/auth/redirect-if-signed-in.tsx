"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Sends an already-signed-in visitor away from login / register. */
export function RedirectIfSignedIn() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      try {
        const res = await fetch("/api/auth/2fa/status", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as {
          required?: boolean;
          verified?: boolean;
        };
        if (res.ok && json.required && !json.verified) {
          router.replace("/verify-2fa");
          return;
        }
      } catch {
        // Fall through to dashboard; app layout will re-check 2FA.
      }
      router.replace("/dashboard");
    })();
  }, [isLoaded, isSignedIn, router]);

  return null;
}
