"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  syncSessionToDatabase,
  wasLoginAnnounced,
} from "@/lib/auth/client-sync";
import { getCountryInfo } from "@/lib/country";

/** Keeps Postgres in sync after Clerk session is established (login / OAuth). */
export function AuthSessionSync() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || ran.current) return;
    ran.current = true;

    void (async () => {
      // Announce login once per browser session (covers OAuth when login page didn't).
      const result = await syncSessionToDatabase({
        announceLogin: !wasLoginAnnounced(),
      });
      if (!result.ok && result.code === "account_disabled") {
        router.replace("/login?error=account_disabled");
        return;
      }
      if (!result.ok) {
        toast.error(result.error ?? "Could not sync your account");
        return;
      }

      if (result.countryCode) {
        const info = getCountryInfo(result.countryCode);
        window.dispatchEvent(
          new CustomEvent("oryno:country-updated", {
            detail: {
              countryCode: info.code,
              currency: info.currency,
              name: info.name,
            },
          }),
        );
      }
    })();
  }, [isLoaded, isSignedIn, router]);

  return null;
}
