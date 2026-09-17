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
import { applyMissingSignUpFields } from "@/lib/auth/complete-signup";
import { clerkErrorMessage } from "@/lib/auth/clerk-errors";
import { syncSessionToDatabase } from "@/lib/auth/client-sync";
import {
  isValidUsername,
  normalizeUsername,
} from "@/lib/auth/username";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { AUTH_LINKS } from "@/lib/auth-links";
import {
  captureReferralFromSearch,
  persistReferralCode,
  readStoredReferralCode,
} from "@/lib/referrals/client";
import { normalizeReferralCode } from "@/lib/referrals/config";

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

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const normalizedUsername = normalizeUsername(username);
  const passwordsMatch =
    password.length > 0 && password === confirmPassword;
  const canCreate =
    isLoaded &&
    !loading &&
    agreed &&
    fullName.trim().length >= 2 &&
    isValidUsername(normalizedUsername) &&
    email.includes("@") &&
    phone.trim().length >= 7 &&
    password.length >= 8 &&
    passwordsMatch;

  useEffect(() => {
    const fromUrl = captureReferralFromSearch(searchParams);
    const stored = readStoredReferralCode();
    const code = fromUrl || stored;
    if (code) setReferralCode(code);
  }, [searchParams]);

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
    const value = pending?.email || signUp?.emailAddress || email || "";
    if (!value) return "your email";
    const [user, domain] = value.split("@");
    if (!domain) return value;
    const masked =
      user.length <= 2 ? `${user[0] ?? "*"}***` : `${user.slice(0, 2)}***`;
    return `${masked}@${domain}`;
  }, [pending?.email, signUp?.emailAddress, email]);

  async function onCreateAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreate || !signUp) return;

    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    const lastName = rest.join(" ") || undefined;

    setError(null);
    setLoading(true);

    const referral = normalizeReferralCode(referralCode);
    if (referral) persistReferralCode(referral);

    try {
      const createPayload: Parameters<typeof signUp.create>[0] = {
        emailAddress: email.trim().toLowerCase(),
        username: normalizedUsername,
        password,
        firstName: firstName || undefined,
        lastName,
        unsafeMetadata: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          username: normalizedUsername,
          ...(referral ? { referralCode: referral } : {}),
        },
      };

      try {
        await signUp.create({ ...createPayload, legalAccepted: true });
      } catch {
        // legalAccepted may be disabled in Clerk dashboard
        await signUp.create(createPayload);
      }

      // Ensure required fields are on the SignUp resource
      await applyMissingSignUpFields(signUp, {
        username: normalizedUsername,
        fullName: fullName.trim(),
        phone: phone.trim(),
        legalAccepted: true,
      });

      try {
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
      } catch {
        await signUp.prepareEmailAddressVerification();
      }

      const nextPending: PendingVerify = {
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        fullName: fullName.trim(),
        username: normalizedUsername,
      };
      setPending(nextPending);
      sessionStorage.setItem(
        "oryno_pending_verify",
        JSON.stringify({ ...nextPending, signUpId: signUp.id }),
      );

      setOtp("");
      setSeconds(54);
      setStep("otp");
    } catch (err) {
      const message = clerkErrorMessage(err, "Could not create your account.");
      // Common when username is taken or Clerk needs continue flow
      if (/additional information|missing/i.test(message) && signUp?.id) {
        router.push("/continue");
        return;
      }
      setError(message);
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

      result = (await applyMissingSignUpFields(result as typeof signUp, {
        username: pending?.username ?? normalizedUsername,
        fullName: pending?.fullName ?? fullName,
        phone: pending?.phone ?? phone,
        legalAccepted: true,
      })) as typeof result;

      if (result.status === "complete") {
        await completeSession(result.createdSessionId);
        return;
      }

      if (signUp.status === "complete" && signUp.createdSessionId) {
        await completeSession(signUp.createdSessionId);
        return;
      }

      if (result.status === "missing_requirements") {
        router.push("/continue");
        return;
      }

      const missing = result.missingFields?.join(", ");
      setError(
        missing
          ? `Almost done — still need: ${missing.replace(/_/g, " ")}.`
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
            onChange={setOtp}
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

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Didn&apos;t get a code?{" "}
            {seconds > 0 ? (
              <span className="font-semibold text-foreground">
                Resend in {seconds}s
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
          <div id="clerk-captcha" className="mt-4" />
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
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
              className={authInputClassName}
            />
          </AuthField>

          <AuthField label="Username">
            <input
              type="text"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. john@oryno.com"
              autoComplete="email"
              required
              className={authInputClassName}
            />
          </AuthField>

          <AuthField label="Phone Number">
            <input
              type="tel"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +234 801 234 5678"
              autoComplete="tel"
              required
              className={authInputClassName}
            />
          </AuthField>

          <PasswordField
            label="Password"
            name="password"
            placeholder="Create password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={setPassword}
          />

          <PasswordField
            label="Confirm Password"
            name="confirmPassword"
            placeholder="Repeat password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          <AuthField label="Referral code (optional)">
            <input
              type="text"
              name="referralCode"
              value={referralCode}
              onChange={(e) => {
                const next = e.target.value.toUpperCase();
                setReferralCode(next);
                persistReferralCode(next);
              }}
              placeholder="e.g. ORYCHID1A2B"
              autoComplete="off"
              className={authInputClassName}
            />
          </AuthField>
        </div>

        {password && confirmPassword && !passwordsMatch ? (
          <p className="mt-3 text-sm text-destructive">
            Passwords do not match.
          </p>
        ) : null}

        <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            className="mt-0.5 h-5 w-5 rounded-[6px] border-primary data-[state=checked]:bg-primary"
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-semibold text-primary">
              Terms of Service
            </Link>{" "}
            &{" "}
            <Link href="/privacy" className="font-semibold text-primary">
              Privacy Policy
            </Link>
          </span>
        </label>

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}

        <motion.button
          type="submit"
          disabled={!canCreate}
          whileHover={canCreate ? { y: -2 } : undefined}
          whileTap={canCreate ? { scale: 0.985 } : undefined}
          className="btn-primary mt-6 h-12 w-full text-base disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Creating account…"
            : !isLoaded
              ? "Loading…"
              : "Create Account"}
        </motion.button>

        <div id="clerk-captcha" className="mt-3" />

        <SocialAuth className="mt-7" mode="signUp" />

        <p className="pt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={AUTH_LINKS.signIn}
            className="font-semibold text-black transition-colors hover:text-black"
          >
            <span className="text-black"> Sign In</span>
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RedirectIfSignedIn />
      <RegisterForm />
    </Suspense>
  );
}
