"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { syncSessionToDatabase } from "@/lib/auth/client-sync";

/** Keeps Postgres in sync after Clerk session is established (login / OAuth). */
export function AuthSessionSync() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || ran.current) return;
    ran.current = true;

    void (async () => {
      const result = await syncSessionToDatabase();
      if (!result.ok && result.code === "account_disabled") {
        router.replace("/login?error=account_disabled");
        return;
      }
      if (result.ok) {
        window.dispatchEvent(
          new CustomEvent("oryno:country-updated", {
            detail: {
              countryCode: result.countryCode,
              currency: result.currency,
            },
          }),
        );
      }
    })();
  }, [isLoaded, isSignedIn, router]);

  return null;
}
