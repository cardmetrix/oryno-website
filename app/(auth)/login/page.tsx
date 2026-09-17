"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { PasswordField } from "@/components/auth/password-field";
import { SocialAuth } from "@/components/auth/social-auth";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { clerkErrorMessage, pickLoginSecondFactor } from "@/lib/auth/clerk-errors";
import { syncSessionToDatabase } from "@/lib/auth/client-sync";
import { RedirectIfSignedIn } from "@/components/auth/redirect-if-signed-in";
import { AUTH_LINKS } from "@/lib/auth-links";

type LoginStep = "credentials" | "otp" | "totp";

type SignInLike = NonNullable<ReturnType<typeof useSignIn>["signIn"]>;

function getEmailOtpFactor(resource: SignInLike) {
  const factor = (resource.supportedSecondFactors || []).find(
    (f: { strategy: string }) => f.strategy === "email_code",
  ) as
    | {
        strategy: "email_code";
        emailAddressId: string;
        safeIdentifier: string;
      }
    | undefined;

  if (!factor) return null;
  return {
    emailAddressId: factor.emailAddressId,
    safeIdentifier: factor.safeIdentifier,
  };
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [otpEmail, setOtpEmail] = useState("");
  const [emailAddressId, setEmailAddressId] = useState("");

  const canSubmit =
    isLoaded &&
    !loading &&
    identifier.trim().length > 2 &&
    password.length >= 1;

  const banner = useMemo(() => {
    const code = searchParams.get("error");
    if (code === "account_disabled") {
      return "This account has been disabled. Contact support.";
    }
    if (code === "sync_failed") {
      return "We couldn’t finish signing you in. Please try again.";
    }
    if (code === "additional_info") {
      return "Finish the missing account details to continue.";
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds]);

  function redirectAfterLogin() {
    const redirectUrl = searchParams.get("redirect_url");
    const safeRedirect =
      redirectUrl &&
      redirectUrl.startsWith("/") &&
      !redirectUrl.startsWith("//")
        ? redirectUrl
        : "/dashboard";
    router.replace(safeRedirect);
  }

  async function finishSignIn(sessionId: string | null | undefined) {
    if (!sessionId || !setActive) {
      throw new Error("No session was created after verification.");
    }
    await setActive({ session: sessionId });
    const sync = await syncSessionToDatabase({ announceLogin: true });
    if (!sync.ok) {
      setError(sync.error ?? "Signed in, but account sync failed.");
      if (sync.code === "account_disabled") {
        router.replace("/login?error=account_disabled");
      }
      return;
    }
    if (sync.twoFactorRequired) {
      router.replace("/verify-2fa");
      return;
    }
    redirectAfterLogin();
  }

  async function sendEmailOtp(resource: SignInLike) {
    const emailFactor = getEmailOtpFactor(resource);
    if (!emailFactor) {
      throw new Error(
        "Email OTP is not available for this sign-in. Enable email verification in Clerk.",
      );
    }

    await resource.prepareSecondFactor({
      strategy: "email_code",
      emailAddressId: emailFactor.emailAddressId,
    });

    setEmailAddressId(emailFactor.emailAddressId);
    setOtpEmail(emailFactor.safeIdentifier || identifier.trim());
    setOtp("");
    setSeconds(54);
    setStep("otp");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || !signIn || !setActive) return;

    setError(null);
    setLoading(true);

    try {
      const result = await signIn.create({
        identifier: identifier.trim(),
        password,
      });

      if (result.status === "complete") {
        await finishSignIn(result.createdSessionId);
        return;
      }

      // After password, Clerk may require TOTP or email OTP.
      if (
        result.status === "needs_second_factor" ||
        (result.status as string) === "needs_client_trust"
      ) {
        const next =
          result.status === "needs_second_factor"
            ? pickLoginSecondFactor(result.supportedSecondFactors)
            : "email_code";
        if (next === "totp") {
          setOtp("");
          setError(null);
          setStep("totp");
          return;
        }
        await sendEmailOtp(result);
        return;
      }

      if (result.status === "needs_new_password") {
        setError("You need to set a new password before signing in.");
        return;
      }

      if (result.status === "needs_first_factor") {
        setError("Additional steps are required to finish signing in.");
        return;
      }

      router.push("/continue");
    } catch (err) {
      const message = clerkErrorMessage(
        err,
        "Invalid email/phone or password.",
      );
      if (/additional information|missing_requirements|continue/i.test(message)) {
        router.push("/continue");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyTotp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signIn || !setActive) return;

    const code = otp.replace(/\D/g, "");
    if (code.length < 6) {
      setError("Enter the 6-digit code from Google Authenticator.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "totp",
        code,
      });

      if (result.status === "complete") {
        await finishSignIn(result.createdSessionId);
        return;
      }

      setError("Verification incomplete. Try a new authenticator code.");
    } catch (err) {
      setError(clerkErrorMessage(err, "Invalid authenticator code. Try again."));
    } finally {
      setLoading(false);
    }
  }

  async function switchToEmail() {
    if (!signIn) return;
    setError(null);
    setLoading(true);
    try {
      await sendEmailOtp(signIn);
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not send an email code."));
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signIn || !setActive) return;

    const code = otp.replace(/\D/g, "");
    if (code.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code,
      });

      if (result.status === "complete") {
        await finishSignIn(result.createdSessionId);
        return;
      }

      setError("Verification incomplete. Request a new code and try again.");
    } catch (err) {
      setError(clerkErrorMessage(err, "Invalid or expired code. Try resend."));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!isLoaded || !signIn || !emailAddressId) return;
    setError(null);
    try {
      await signIn.prepareSecondFactor({
        strategy: "email_code",
        emailAddressId,
      });
      setSeconds(54);
      setOtp("");
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not resend the code."));
    }
  }

  if (step === "totp") {
    const canEmail =
      (signIn?.supportedSecondFactors || []).some(
        (f: { strategy: string }) => f.strategy === "email_code",
      ) ?? false;

    return (
      <AuthSplitLayout
        title="Authenticator code"
        subtitle="Enter the 6-digit code from Google Authenticator."
        panelTitle="One more step to your wallet."
        panelSubtitle="Confirm the code from your authenticator app to finish signing in."
        top={
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setError(null);
              setOtp("");
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Back to Sign In
          </button>
        }
      >
        <form onSubmit={onVerifyTotp} className="flex flex-col">
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

          {canEmail ? (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Can’t open your authenticator?{" "}
              <button
                type="button"
                onClick={() => void switchToEmail()}
                className="font-semibold text-primary"
              >
                Use email code
              </button>
            </p>
          ) : (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Open Google Authenticator and use the current code.
            </p>
          )}

          {error ? (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : null}

          <motion.button
            type="submit"
            disabled={!isLoaded || loading || otp.length < 6}
            whileHover={otp.length >= 6 ? { y: -2 } : undefined}
            whileTap={otp.length >= 6 ? { scale: 0.985 } : undefined}
            className="btn-primary mt-8 h-12 w-full text-base disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & Sign In"}
          </motion.button>
          <div id="clerk-captcha" className="mt-4" />
        </form>
      </AuthSplitLayout>
    );
  }

  if (step === "otp") {
    return (
      <AuthSplitLayout
        title="Verify it’s you"
        subtitle={`We’ve sent a 6-digit code to ${otpEmail || "your email"}.`}
        panelTitle="One more step to your wallet."
        panelSubtitle="Confirm the code from your email to finish signing in."
        top={
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setError(null);
              setOtp("");
              setEmailAddressId("");
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Back to Sign In
          </button>
        }
      >
        <form onSubmit={onVerifyOtp} className="flex flex-col">
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

          <motion.button
            type="submit"
            disabled={!isLoaded || loading || otp.length < 6}
            whileHover={otp.length >= 6 ? { y: -2 } : undefined}
            whileTap={otp.length >= 6 ? { scale: 0.985 } : undefined}
            className="btn-primary mt-8 h-12 w-full text-base disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & Sign In"}
          </motion.button>
          <div id="clerk-captcha" className="mt-4" />
        </form>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      title="Welcome back"
      subtitle="Sign in to access your borderless wallet."
      panelTitle="Your money, moving with you."
      panelSubtitle="Sign in to manage airtime, data, bills, and payouts from one secure wallet."
    >
      <form onSubmit={onSubmit} className="flex flex-col">
        {banner ? (
          <p className="mb-4 rounded-[14px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {banner}
          </p>
        ) : null}

        <div className="space-y-5">
          <AuthField label="Email or Username">
            <input
              type="text"
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. you@email.com"
              autoComplete="username"
              required
              className={authInputClassName}
            />
          </AuthField>

          <div>
            <PasswordField
              label="Password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={setPassword}
            />
            <div className="mt-2 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-primary transition-colors hover:text-oryno-charcoal"
              >
                Forgot Password?
              </Link>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}

        <motion.button
          type="submit"
          disabled={!canSubmit}
          whileHover={canSubmit ? { y: -2 } : undefined}
          whileTap={canSubmit ? { scale: 0.985 } : undefined}
          className="btn-primary mt-7 h-12 w-full text-base disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in…" : !isLoaded ? "Loading…" : "Sign In"}
        </motion.button>

        <div id="clerk-captcha" className="mt-3" />

        <SocialAuth className="mt-7" mode="signIn" />

        <p className="pt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={AUTH_LINKS.getStarted}
            className="font-semibold text-black transition-colors hover:text-black"
          >
           <span className="text-black"> Create Account</span>
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <RedirectIfSignedIn />
      <LoginForm />
    </Suspense>
  );
}
