"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import {
  bootCrisp,
  isCrispConfigured,
  openCrispChat,
} from "@/lib/support/crisp";

export function CrispChatBoot() {
  const { user } = useUser();

  useEffect(() => {
    if (!isCrispConfigured()) return;
    bootCrisp({
      email: user?.primaryEmailAddress?.emailAddress,
      nickname: user?.fullName,
      userId: user?.id,
    });
  }, [user?.id, user?.fullName, user?.primaryEmailAddress?.emailAddress]);

  return null;
}

export function startLiveSupport() {
  if (openCrispChat()) return true;
  if (typeof window !== "undefined") {
    window.location.href = `mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@orynoafrica.com"}`;
  }
  return false;
}
