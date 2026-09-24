"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReverification, useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Globe2,
  Loader2,
  Mail,
  Phone,
  Shield,
  UserRound,
  AtSign,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ProfileSkeleton } from "@/components/app/profile-skeleton";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { clerkErrorMessage } from "@/lib/auth/clerk-errors";
import { useUploadThing } from "@/lib/uploadthing";
import type { ProfileDto } from "@/lib/profile";
import { cn } from "@/lib/utils";

type EditableField = "fullName" | "phone" | "username" | "email";

type EmailAddressResource = NonNullable<
  NonNullable<ReturnType<typeof useUser>["user"]>["emailAddresses"][number]
>;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function initialsFrom(name?: string | null) {
  if (!name) return "OR";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "OR"
  );
}

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [enriching, setEnriching] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    username: "",
    email: "",
  });
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailObj, setEmailObj] = useState<EmailAddressResource | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const createEmailAddress = useReverification((email: string) =>
    user?.createEmailAddress({ email }),
  );

  const bootstrapFromClerk = useMemo(() => {
    if (!user) return null;
    const fullName =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      "ORYNO User";
    const phone =
      (typeof user.unsafeMetadata?.phone === "string"
        ? user.unsafeMetadata.phone
        : null) ||
      user.primaryPhoneNumber?.phoneNumber ||
      null;
    const username =
      user.username ||
      (typeof user.unsafeMetadata?.username === "string"
        ? user.unsafeMetadata.username
        : null);
    const avatarUrl =
      (typeof user.publicMetadata?.avatarUrl === "string"
        ? user.publicMetadata.avatarUrl
        : null) || user.imageUrl;

    return {
      id: user.id,
      clerkId: user.id,
      username,
      fullName,
      email: user.primaryEmailAddress?.emailAddress || "",
      phone,
      avatarUrl,
      countryCode: null,
      countryName: "Loading…",
      role: "user",
      kycStatus: "unverified",
      kycLevel: 0,
      kycLabel: "Checking…",
      status: "active",
      dailyLimitLabel: "—",
      emailVerified: Boolean(
        user.primaryEmailAddress?.verification?.status === "verified",
      ),
      initials: initialsFrom(fullName),
    } satisfies ProfileDto;
  }, [user]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load profile");
      const data = (await res.json()) as { profile: ProfileDto };
      setProfile(data.profile);
      setForm({
        fullName: data.profile.fullName,
        phone: data.profile.phone || "",
        username: data.profile.username || "",
        email: data.profile.email || "",
      });
    } catch {
      // Keep Clerk bootstrap visible
    } finally {
      setEnriching(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !user || !bootstrapFromClerk) return;

    setProfile((prev) => prev ?? bootstrapFromClerk);
    setForm((prev) =>
      prev.fullName
        ? prev
        : {
            fullName: bootstrapFromClerk.fullName,
            phone: bootstrapFromClerk.phone || "",
            username: bootstrapFromClerk.username || "",
            email: bootstrapFromClerk.email || "",
          },
    );

    void loadProfile();
    // Intentionally depend on user id only — avoid refetch loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);

  useEffect(() => {
    if (!verifyingEmail || resendSeconds <= 0) return;
    const id = window.setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [verifyingEmail, resendSeconds]);

  const { startUpload, isUploading } = useUploadThing("profileImage", {
    onClientUploadComplete: async (res) => {
      const url = res?.[0]?.ufsUrl || res?.[0]?.url;
      if (!url) return;

      try {
        const patch = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarUrl: url }),
        });
        if (!patch.ok) throw new Error("Could not save avatar");
        const data = (await patch.json()) as { profile: ProfileDto };
        setProfile(data.profile);
        await user?.reload();
        toast.success("Profile photo updated");
      } catch {
        toast.error("Photo uploaded, but saving failed");
      }
    },
    onUploadError: (err) => {
      toast.error(err.message || "Upload failed. Check UploadThing token.");
    },
  });

  const display = profile || bootstrapFromClerk;

  async function syncProfileFields() {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        username: form.username.trim(),
      }),
    });
    const data = (await res.json()) as { profile?: ProfileDto; error?: string };
    if (!res.ok || !data.profile) {
      throw new Error(data.error || "Could not save profile");
    }
    setProfile(data.profile);
    return data.profile;
  }

  async function startEmailChange(nextEmail: string) {
    if (!user) throw new Error("Not signed in");
    const existing = user.emailAddresses.find(
      (e) => normalizeEmail(e.emailAddress) === nextEmail,
    );
    const target =
      existing ??
      (await createEmailAddress(nextEmail)) ??
      null;
    if (!target) throw new Error("Could not add that email address.");
    if (target.verification?.status !== "verified") {
      await target.prepareVerification({ strategy: "email_code" });
    }
    setEmailObj(target);
    setEmailCode("");
    setVerifyingEmail(true);
    setResendSeconds(45);
  }

  async function saveProfile() {
    if (!user) return;
    const nextEmail = normalizeEmail(form.email);
    const currentEmail = normalizeEmail(display?.email || "");
    if (!isValidEmail(nextEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setSaving(true);
    try {
      await syncProfileFields();

      if (nextEmail !== currentEmail) {
        await startEmailChange(nextEmail);
        toast.success("We sent a verification code to your new email.");
        return;
      }

      setEditing(false);
      await user.reload();
      toast.success("Profile saved");
    } catch (err) {
      toast.error(clerkErrorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function verifyEmailCode(code = emailCode) {
    if (!user || !emailObj) return;
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length < 6) {
      toast.error("Enter the 6-digit code from your email.");
      return;
    }
    setEmailBusy(true);
    try {
      let target = emailObj;
      if (target.verification?.status !== "verified") {
        const result = await target.attemptVerification({ code: cleaned });
        if (result.verification.status !== "verified") {
          throw new Error("Invalid or expired verification code.");
        }
        target = result;
      }

      await user.update({ primaryEmailAddressId: target.id });

      // Best-effort cleanup of previous emails so login uses the new one.
      const refreshed = await user.reload();
      await Promise.all(
        refreshed.emailAddresses
          .filter((e) => e.id !== target.id)
          .map((e) => e.destroy().catch(() => null)),
      );

      const profile = await syncProfileFields();
      setForm((f) => ({ ...f, email: profile.email }));
      setVerifyingEmail(false);
      setEmailObj(null);
      setEmailCode("");
      setEditing(false);
      await user.reload();
      toast.success("Email updated");
    } catch (err) {
      toast.error(clerkErrorMessage(err, "Could not verify email"));
    } finally {
      setEmailBusy(false);
    }
  }

  async function resendEmailCode() {
    if (!emailObj || resendSeconds > 0) return;
    setEmailBusy(true);
    try {
      await emailObj.prepareVerification({ strategy: "email_code" });
      setResendSeconds(45);
      toast.success("Code resent");
    } catch (err) {
      toast.error(clerkErrorMessage(err, "Could not resend code"));
    } finally {
      setEmailBusy(false);
    }
  }

  function resetEmailVerification() {
    setVerifyingEmail(false);
    setEmailObj(null);
    setEmailCode("");
    setResendSeconds(0);
  }

  function onPickPhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void startUpload([file]);
    };
    input.click();
  }

  const verified =
    display?.kycStatus === "verified" || display?.emailVerified;

  if (!isLoaded || !display) {
    return (
      <AppShell>
        <PageHeader
          title="Profile"
          subtitle="Manage your ORYNO identity"
          backHref="/dashboard"
        />
        <ProfileSkeleton />
      </AppShell>
    );
  }

  const fields: Array<{
    key: EditableField | "email" | "country";
    label: string;
    value: string;
    icon: typeof Mail;
    editable?: boolean;
  }> = [
    {
      key: "fullName",
      label: "Full Name",
      value: display.fullName,
      icon: UserRound,
      editable: true,
    },
    {
      key: "username",
      label: "Username",
      value: display.username ? `@${display.username}` : "Not set",
      icon: AtSign,
      editable: true,
    },
    {
      key: "email",
      label: "Email Address",
      value: display.email,
      icon: Mail,
      editable: true,
    },
    {
      key: "phone",
      label: "Phone Number",
      value: display.phone || "Not set",
      icon: Phone,
      editable: true,
    },
    {
      key: "country",
      label: "Country",
      value: enriching ? "Loading…" : display.countryName,
      icon: Globe2,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Profile"
        subtitle="Manage your ORYNO identity"
        backHref="/dashboard"
      />

      <MotionSection className="relative overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] sm:h-32"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.28),transparent_50%)] sm:h-32"
        />

        <div className="relative px-4 pt-14 pb-5 sm:px-6 sm:pt-16 sm:pb-6">
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="relative"
            >
              <div className="relative h-24 w-24 overflow-hidden rounded-full bg-oryno-orange-muted ring-4 ring-background shadow-[0_12px_40px_rgba(255,106,0,0.35)] sm:h-28 sm:w-28">
                {display.avatarUrl ? (
                  <Image
                    src={display.avatarUrl}
                    alt={display.fullName}
                    fill
                    className="object-cover"
                    sizes="112px"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary sm:text-3xl">
                    {display.initials}
                  </div>
                )}
                {isUploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                ) : null}
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={onPickPhoto}
                disabled={isUploading}
                className="absolute -right-1 -bottom-1 flex h-10 w-10 items-center justify-center rounded-full bg-oryno-charcoal text-white shadow-lg ring-4 ring-background disabled:opacity-60"
                aria-label="Upload profile photo"
              >
                <Camera className="h-4 w-4" />
              </motion.button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl"
            >
              {display.fullName}
            </motion.p>
            {display.username ? (
              <p className="mt-1 text-sm text-muted-foreground">
                @{display.username}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                  verified
                    ? "bg-oryno-success/12 text-oryno-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {verified ? (
                  <BadgeCheck className="h-3.5 w-3.5" />
                ) : (
                  <Shield className="h-3.5 w-3.5" />
                )}
                {enriching ? "Syncing…" : display.kycLabel}
              </span>
              <span className="inline-flex items-center rounded-full bg-oryno-orange-muted px-2.5 py-1 text-xs font-semibold text-primary">
                {display.countryCode || "—"}
              </span>
            </div>
          </div>
        </div>
      </MotionSection>

      <MotionSection
        delay={0.06}
        className="mt-5 overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]"
      >
        <AnimatePresence mode="wait">
          {verifyingEmail ? (
            <motion.div
              key="verify-email"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4 p-4 sm:p-5"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Verify your new email
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter the 6-digit code we sent to{" "}
                  <span className="font-semibold text-foreground">
                    {normalizeEmail(form.email)}
                  </span>
                  .
                </p>
              </div>
              <InputOTP
                maxLength={6}
                value={emailCode}
                onChange={setEmailCode}
                containerClassName="justify-between gap-2"
              >
                <InputOTPGroup className="w-full justify-between gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-12 w-11 rounded-[12px] border border-border text-base sm:h-14 sm:w-12"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <p className="text-center text-sm text-muted-foreground">
                Didn&apos;t get a code?{" "}
                {resendSeconds > 0 ? (
                  <span className="font-semibold text-foreground">
                    Resend in {resendSeconds}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void resendEmailCode()}
                    disabled={emailBusy}
                    className="font-semibold text-primary disabled:opacity-60"
                  >
                    Resend
                  </button>
                )}
              </p>
            </motion.div>
          ) : editing ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4 p-4 sm:p-5"
            >
              <AuthField label="Full Name">
                <input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  className={authInputClassName}
                />
              </AuthField>
              <AuthField label="Username">
                <input
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  className={authInputClassName}
                />
              </AuthField>
              <AuthField label="Email Address">
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className={authInputClassName}
                />
              </AuthField>
              <AuthField label="Phone Number">
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className={authInputClassName}
                />
              </AuthField>
              <p className="text-xs text-muted-foreground">
                Changing your email sends a verification code to the new
                address. Your login email updates after you verify.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="view"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              {fields.map((field, index) => {
                const Icon = field.icon;
                return (
                  <motion.div
                    key={field.key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 + index * 0.03 }}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3.5 sm:px-5",
                      index > 0 && "border-t border-border",
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {field.label}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                        {field.value}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

      </MotionSection>

      <MotionSection delay={0.1} className="mt-5 space-y-3">
        {verifyingEmail ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                resetEmailVerification();
                setForm({
                  fullName: display.fullName,
                  phone: display.phone || "",
                  username: display.username || "",
                  email: display.email || "",
                });
              }}
              className="btn-secondary inline-flex h-12 items-center justify-center text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={emailBusy || emailCode.length < 6}
              onClick={() => void verifyEmailCode()}
              className="btn-primary inline-flex h-12 items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {emailBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Verify email
            </button>
          </div>
        ) : editing ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                resetEmailVerification();
                setForm({
                  fullName: display.fullName,
                  phone: display.phone || "",
                  username: display.username || "",
                  email: display.email || "",
                });
              }}
              className="btn-secondary inline-flex h-12 items-center justify-center text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveProfile()}
              className="btn-primary inline-flex h-12 items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </button>
          </div>
        ) : (
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            onClick={() => setEditing(true)}
            className="btn-primary inline-flex h-12 w-full items-center justify-center text-base"
          >
            Edit Profile
          </motion.button>
        )}

        <Link
          href="/settings"
          className="group flex items-center justify-between rounded-[18px] border border-border bg-background px-4 py-3.5 shadow-[var(--shadow-soft)] transition hover:border-primary/30 hover:bg-muted/40"
        >
          <span className="text-sm font-semibold text-foreground">Settings</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
        <Link
          href="/referrals"
          className="group flex items-center justify-between rounded-[18px] border border-border bg-background px-4 py-3.5 shadow-[var(--shadow-soft)] transition hover:border-primary/30 hover:bg-muted/40"
        >
          <span className="text-sm font-semibold text-foreground">
            Refer & earn
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
        <Link
          href="/settings/security"
          className="group flex items-center justify-between rounded-[18px] border border-border bg-background px-4 py-3.5 shadow-[var(--shadow-soft)] transition hover:border-primary/30 hover:bg-muted/40"
        >
          <span className="text-sm font-semibold text-foreground">
            Security & PIN
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
      </MotionSection>
    </AppShell>
  );
}
