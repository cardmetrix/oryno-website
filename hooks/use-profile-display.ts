"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import type { ProfileDto } from "@/lib/profile";

function initialsFrom(name?: string | null) {
  if (!name) return "OR";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "OR"
  );
}

function bootstrapFromClerkUser(
  user: NonNullable<ReturnType<typeof useUser>["user"]>,
): ProfileDto {
  const fullName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    "ORYNO User";
  const avatarUrl =
    (typeof user.publicMetadata?.avatarUrl === "string"
      ? user.publicMetadata.avatarUrl
      : null) || user.imageUrl;

  return {
    id: user.id,
    clerkId: user.id,
    username:
      user.username ||
      (typeof user.unsafeMetadata?.username === "string"
        ? user.unsafeMetadata.username
        : null),
    fullName,
    email: user.primaryEmailAddress?.emailAddress || "",
    phone:
      (typeof user.unsafeMetadata?.phone === "string"
        ? user.unsafeMetadata.phone
        : null) ||
      user.primaryPhoneNumber?.phoneNumber ||
      null,
    avatarUrl,
    countryCode: null,
    countryName: "Loading…",
    kycStatus: "unverified",
    kycLevel: 0,
    kycLabel: "Checking…",
    accountLevelName: "Unverified",
    status: "active",
    dailyLimitLabel: "—",
    emailVerified: Boolean(
      user.primaryEmailAddress?.verification?.status === "verified",
    ),
    initials: initialsFrom(fullName),
  };
}

export function useProfileDisplay() {
  const { user, isLoaded } = useUser();
  const [profile, setProfile] = useState<ProfileDto | null>(null);

  const bootstrap = useMemo(
    () => (user ? bootstrapFromClerkUser(user) : null),
    [user],
  );

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load profile");
      const data = (await res.json()) as { profile: ProfileDto };
      setProfile(data.profile);
    } catch {
      // Keep Clerk bootstrap visible
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !user || !bootstrap) return;
    setProfile((prev) => prev ?? bootstrap);
    const timeoutId = window.setTimeout(() => void loadProfile(), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [isLoaded, user?.id, bootstrap, loadProfile]);

  const display = profile || bootstrap;
  const firstName =
    user?.firstName?.trim() ||
    display?.fullName.split(/\s+/)[0] ||
    "there";

  return { display, firstName, isLoaded };
}
