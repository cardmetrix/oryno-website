"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureReferralFromSearch } from "@/lib/referrals/client";

/** Persist `?ref=` from any page so signup/sync can attach the referral. */
export function ReferralCapture() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    captureReferralFromSearch(searchParams);
  }, [searchParams, pathname]);

  return null;
}
