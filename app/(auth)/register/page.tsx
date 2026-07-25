"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { PasswordField } from "@/components/auth/password-field";
import { SocialAuth } from "@/components/auth/social-auth";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { clerkErrorMessage } from "@/lib/auth/clerk-errors";
import { syncSessionToDatabase } from "@/lib/auth/client-sync";
import {
  isValidUsername,
  normalizeUsername,
} from "@/lib/auth/username";
import { AUTH_LINKS } from "@/lib/auth-links";
import { cn } from "@/lib/utils";

type Step = "details" | "otp";

type PendingVerify = {
  email: string;
  phone: string;
  fullName: string;
  username: string;
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [step, setStep] = useState<Step>("details");
  const [pending, setPending] = useState<PendingVerify | null>(null);
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(54);

  // Resume OTP step after /otp redirect or refresh when Clerk still has a SignUp.
  useEffect(() => {
    if (!isLoaded) return;

    try {
      const raw = sessionStorage.getItem("oryno_pending_verify");
      if (!raw) return;
      const stored = JSON.parse(raw) as PendingVerify;
      const wantsVerify = searchParams.get("verify") === "1";
      const hasActiveSignUp = Boolean(signUp?.id);

      if ((wantsVerify || hasActiveSignUp) && stored.email) {
        setPending(stored);
        setStep("otp");
      }
    } catch {
      // ignore
    }
  }, [isLoaded, searchParams, signUp?.id]);

  useEffect(() => {
    if (step !== "otp" || seconds <= 0) return;
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, seconds]);

  const destination = useMemo(() => {
    const email = pending?.email || signUp?.emailAddress || "";
    if (!email) return "your email";
    const [user, domain] = email.split("@");
    if (!domain) return email;
    const masked =
      user.length <= 2 ? `${user[0] ?? "*"}***` : `${user.slice(0, 2)}***`;
    return `${masked}@${domain}`;
  }, [pending?.email, signUp?.emailAddress]);

  async function onCreateAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agreed || !isLoaded || !signUp) return;

    const form = new FormData(e.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const username = normalizeUsername(String(form.get("username") ?? ""));
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const phone = String(form.get("phone") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (!isValidUsername(username)) {
      setError("Username must be 3–32 characters (letters, numbers, _).");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(" ") || undefined;

    setError(null);
    setLoading(true);

    try {
      await signUp.create({
        emailAddress: email,
        username,
        password,
        firstName: firstName || undefined,
        lastName,
        unsafeMetadata: {
          fullName,
          phone,
          username,
        },
      });

      try {
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
      } catch {
        await signUp.prepareEmailAddressVerification();
      }

      const nextPending = { email, phone, fullName, username };
      setPending(nextPending);
      sessionStorage.setItem(
        "oryno_pending_verify",
        JSON.stringify({ ...nextPending, signUpId: signUp.id }),
      );

      // Stay on this page so Clerk keeps the active SignUp in memory.
      setOtp("");
      setSeconds(54);
      setStep("otp");
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not create your account."));
    } finally {
      setLoading(false);
    }
  }

  async function completeSession(sessionId: string | null) {
    if (!sessionId || !setActive) {
      throw new Error("No session was created after verification.");
    }

    await setActive({ session: sessionId });
    const sync = await syncSessionToDatabase();
    sessionStorage.removeItem("oryno_pending_verify");

    if (!sync.ok) {
      throw new Error(sync.error ?? "Verified, but account sync failed.");
    }

    router.replace("/dashboard");
  }

  async function onVerifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signUp || !setActive) return;

    const code = otp.replace(/\D/g, "");
    if (code.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      let result = await signUp.attemptEmailAddressVerification({ code });

      if (
        result.status === "missing_requirements" &&
        result.missingFields?.includes("username") &&
        pending?.username
      ) {
        result = await signUp.update({ username: pending.username });
      }

      if (result.status === "complete") {
        await completeSession(result.createdSessionId);
        return;
      }

      // Resource may have updated on the hook instance after attempt.
      if (signUp.status === "complete" && signUp.createdSessionId) {
        await completeSession(signUp.createdSessionId);
        return;
      }

      const missing = result.missingFields?.join(", ");
      setError(
        missing
          ? `Almost done — still need: ${missing}.`
          : "Verification incomplete. Request a new code and try again.",
      );
    } catch (err) {
      setError(clerkErrorMessage(err, "Invalid or expired code. Try resend."));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!isLoaded || !signUp) return;
    setError(null);
    try {
      try {
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
      } catch {
        await signUp.prepareEmailAddressVerification();
      }
      setSeconds(54);
      setOtp("");
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not resend the code."));
    }
  }

  if (step === "otp") {
    return (
      <AuthSplitLayout
        title="Verify your email"
        subtitle={`We've sent a 6-digit verification code to ${destination}.`}
        panelTitle="One more step to your wallet."
        panelSubtitle="Confirm your email to secure your ORYNO account and unlock airtime, data, bills, and payouts."
        top={
          <button
            type="button"
            onClick={() => {
              setStep("details");
              setError(null);
              setOtp("");
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Back to Create Account
          </button>
        }
      >
        <form onSubmit={onVerifyOtp} className="flex flex-col">
          {pending?.username ? (
            <p className="mb-4 text-sm text-muted-foreground">
              Username{" "}
              <span className="font-semibold text-foreground">
                @{pending.username}
              </span>
            </p>
          ) : null}

          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(next) => {
              setOtp(next.replace(/\D/g, ""));
              setError(null);
            }}
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
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={!isLoaded || loading || otp.length < 6}
            className="btn-primary mt-8 h-12 w-full text-base disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & Proceed"}
          </button>
        </form>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      title="Create Account"
      subtitle="Join ORYNO and enjoy simplified digital services."
      panelTitle="Start with a borderless wallet."
      panelSubtitle="Create your account to fund, send, and pay for airtime, data, and bills in one place."
    >
      <form onSubmit={onCreateAccount} className="flex flex-col">
        <div className="space-y-4">
          <AuthField label="Full Name">
            <input
              type="text"
              name="fullName"
              placeholder="e.g. Chidi Benson"
              autoComplete="name"
              required
              className={authInputClassName}
            />
          </AuthField>

          <AuthField label="Username">
            <input
              type="text"
              name="username"
              placeholder="e.g. chidi_b"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              title="Letters, numbers, and underscores only"
              className={authInputClassName}
            />
          </AuthField>

          <AuthField label="Email Address">
            <input
              type="email"
              name="email"
              placeholder="e.g. chidi@oryno.com"
              autoComplete="email"
              required
              className={authInputClassName}
            />
          </AuthField>

          <AuthField label="Phone Number">
            <input
              type="tel"
              name="phone"
              placeholder="e.g. +234 801 234 5678"
              autoComplete="tel"
              required
              className={authInputClassName}
            />
          </AuthField>

          <PasswordField
            label="Password"
            name="password"
            placeholder="Create robust password"
            autoComplete="new-password"
            required
          />

          <PasswordField
            label="Confirm Password"
            name="confirmPassword"
            placeholder="Repeat password"
            autoComplete="new-password"
            required
          />
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            className="mt-0.5 h-5 w-5 rounded-[6px] border-primary data-[state=checked]:bg-primary"
          />
          <span>
            I agree to the{" "}
            <Link href="#" className="font-semibold text-primary">
              Terms of Service
            </Link>{" "}
            &{" "}
            <Link href="#" className="font-semibold text-primary">
              Privacy Policy
            </Link>
          </span>
        </label>

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}

        <motion.button
          type="submit"
          disabled={!agreed || !isLoaded || loading}
          whileHover={agreed ? { y: -2 } : undefined}
          whileTap={agreed ? { scale: 0.985 } : undefined}
          className="btn-primary mt-6 h-12 w-full text-base disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create Account"}
        </motion.button>

        <SocialAuth className="mt-7" mode="signUp" />

        <p className="pt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={AUTH_LINKS.signIn}
            className="font-semibold text-primary transition-colors hover:text-oryno-charcoal"
          >
            Sign In
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
