"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncSessionToDatabase } from "@/lib/auth/client-sync";
import { getCountryInfo } from "@/lib/country";

const TOAST_KEY = "oryno_country_toast";

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

        // One toast per browser session when country is resolved
        const toastToken = `${info.code}:${info.currency}`;
        const already = sessionStorage.getItem(TOAST_KEY);
        if (already !== toastToken) {
          sessionStorage.setItem(TOAST_KEY, toastToken);
          toast.success(`Country detected: ${info.name}`, {
            description: `Your wallet currency is ${info.currency} (${info.currencySymbol})`,
          });
        }
      }
    })();
  }, [isLoaded, isSignedIn, router]);

  return null;
}
