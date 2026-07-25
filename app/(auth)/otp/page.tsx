"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { clerkErrorMessage } from "@/lib/auth/clerk-errors";
import { syncSessionToDatabase } from "@/lib/auth/client-sync";
import { cn } from "@/lib/utils";

type PendingVerify = {
  email?: string;
  phone?: string;
  fullName?: string;
  username?: string;
};

export default function OtpPage() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [value, setValue] = useState("");
  const [seconds, setSeconds] = useState(54);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingVerify>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("oryno_pending_verify");
      if (raw) setPending(JSON.parse(raw) as PendingVerify);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    // Sign-up client state is required to verify; if lost, restart register.
    if (!signUp || signUp.status === null) {
      setError("Verification session expired. Please create your account again.");
    }
  }, [isLoaded, signUp]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  const destination = useMemo(() => {
    const email = pending.email || signUp?.emailAddress || "";
    if (!email) return "your email";
    const [user, domain] = email.split("@");
    if (!domain) return email;
    const masked =
      user.length <= 2 ? `${user[0] ?? "*"}***` : `${user.slice(0, 2)}***`;
    return `${masked}@${domain}`;
  }, [pending.email, signUp?.emailAddress]);

  async function finalizeSignUp() {
    if (!signUp || !setActive) return false;

    // Clerk may still require username (or other fields) after email verify.
    if (
      signUp.status === "missing_requirements" &&
      signUp.missingFields?.includes("username") &&
      pending.username
    ) {
      await signUp.update({ username: pending.username });
    }

    if (signUp.status === "complete" && signUp.createdSessionId) {
      await setActive({ session: signUp.createdSessionId });
      const sync = await syncSessionToDatabase();
      sessionStorage.removeItem("oryno_pending_verify");

      if (!sync.ok) {
        setError(sync.error ?? "Verified, but account sync failed.");
        return false;
      }

      router.replace("/dashboard");
      return true;
    }

    return false;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signUp || !setActive) return;

    const code = value.replace(/\D/g, "");
    if (code.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    if (!signUp.id) {
      setError("Verification session expired. Please create your account again.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Already verified in a previous attempt — just finish.
      if (signUp.status === "complete") {
        const ok = await finalizeSignUp();
        if (!ok) setError("Could not finish sign-up. Try resending the code.");
        return;
      }

      const emailStatus = signUp.verifications?.emailAddress?.status;
      if (emailStatus === "verified") {
        const ok = await finalizeSignUp();
        if (!ok) {
          setError(
            "Email verified, but account setup is incomplete. Check username requirements in Clerk.",
          );
        }
        return;
      }

      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        const sync = await syncSessionToDatabase();
        sessionStorage.removeItem("oryno_pending_verify");

        if (!sync.ok) {
          setError(sync.error ?? "Verified, but account sync failed.");
          return;
        }

        router.replace("/dashboard");
        return;
      }

      if (result.status === "missing_requirements") {
        const ok = await finalizeSignUp();
        if (ok) return;

        const missing = result.missingFields?.join(", ") || "required fields";
        setError(`Almost done — still need: ${missing}. Go back and retry.`);
        return;
      }

      setError("Verification incomplete. Please try again or resend the code.");
    } catch (err) {
      setError(clerkErrorMessage(err, "Invalid or expired code."));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!isLoaded || !signUp?.id) {
      setError("Verification session expired. Please create your account again.");
      return;
    }
    setError(null);
    try {
      try {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      } catch {
        await signUp.prepareEmailAddressVerification();
      }
      setSeconds(54);
      setValue("");
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not resend the code."));
    }
  }

  return (
    <AuthSplitLayout
      title="Verify your email"
      subtitle={`We've sent a 6-digit verification code to ${destination}.`}
      panelTitle="One more step to your wallet."
      panelSubtitle="Confirm your email to secure your ORYNO account and unlock airtime, data, bills, and payouts."
      top={
        <Link
          href="/register"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to Create Account
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col">
        {pending.username ? (
          <p className="mb-4 text-sm text-muted-foreground">
            Username{" "}
            <span className="font-semibold text-foreground">
              @{pending.username}
            </span>
          </p>
        ) : null}

        <InputOTP
          maxLength={6}
          value={value}
          onChange={(next) => setValue(next.replace(/\D/g, ""))}
          containerClassName="justify-between gap-2"
        >
          <InputOTPGroup className="flex w-full justify-between gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className={cn(
                  "h-14 w-12 rounded-[14px] border border-oryno-gray-divider bg-muted/40 text-lg font-semibold shadow-none first:rounded-[14px] first:border-l last:rounded-[14px]",
                  "ring-offset-0 first:rounded-[14px] last:rounded-[14px]",
                )}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <p className="mt-5 text-sm text-muted-foreground">
          Didn&apos;t receive code?{" "}
          {seconds > 0 ? (
            <span className="font-semibold text-primary">
              Resend in {String(Math.floor(seconds / 60))}:
              {String(seconds % 60).padStart(2, "0")}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void resend()}
              className="font-semibold text-primary"
            >
              Resend
            </button>
          )}
        </p>

        {error ? (
          <p className="mt-4 text-sm text-destructive">
            {error}{" "}
            {error.toLowerCase().includes("expired") ? (
              <Link href="/register" className="font-semibold underline">
                Register again
              </Link>
            ) : null}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!isLoaded || loading || value.length < 6}
          className="btn-primary mt-8 h-12 w-full text-base disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify & Proceed"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
