"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { PasswordField } from "@/components/auth/password-field";
import { clerkErrorMessage } from "@/lib/auth/clerk-errors";
import { AUTH_LINKS } from "@/lib/auth-links";

type Step = "request" | "reset" | "done";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    const form = new FormData(e.currentTarget);
    const nextEmail = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();

    setError(null);
    setLoading(true);

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: nextEmail,
      });
      setEmail(nextEmail);
      setStep("reset");
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not send a reset code."));
    } finally {
      setLoading(false);
    }
  }

  async function onReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signIn || !setActive) return;

    const form = new FormData(e.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setStep("done");
        window.setTimeout(() => router.replace("/dashboard"), 1200);
        return;
      }

      setError("Password reset incomplete. Try again.");
    } catch (err) {
      setError(clerkErrorMessage(err, "Invalid code or password."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      title="Forgot Password"
      subtitle="Enter your email and we’ll send a reset code to get you back in."
      panelTitle="Secure access, always."
      panelSubtitle="Reset your password in seconds and get back to your wallet, airtime, and bills."
      top={
        <Link
          href={AUTH_LINKS.signIn}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to Sign In
        </Link>
      }
    >
      {step === "done" ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-[16px] border border-border bg-muted/50 p-5"
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
            <MailCheck className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <p className="text-base font-semibold text-foreground">
            Password updated
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You&apos;re signed in. Redirecting to your dashboard…
          </p>
        </motion.div>
      ) : step === "reset" ? (
        <form onSubmit={onReset} className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Enter the code sent to <span className="font-semibold">{email}</span>{" "}
            and choose a new password.
          </p>

          <AuthField label="Reset code">
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className={authInputClassName}
            />
          </AuthField>

          <PasswordField
            label="New password"
            name="password"
            autoComplete="new-password"
            required
          />
          <PasswordField
            label="Confirm password"
            name="confirmPassword"
            autoComplete="new-password"
            required
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <motion.button
            type="submit"
            disabled={!isLoaded || loading}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            className="btn-primary h-12 w-full text-base disabled:opacity-60"
          >
            {loading ? "Updating…" : "Update password"}
          </motion.button>
        </form>
      ) : (
        <form onSubmit={onRequest} className="space-y-6">
          <AuthField label="Email Address">
            <input
              type="email"
              name="email"
              placeholder="e.g. John@oryno.com"
              autoComplete="email"
              required
              className={authInputClassName}
            />
          </AuthField>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <motion.button
            type="submit"
            disabled={!isLoaded || loading}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            className="btn-primary h-12 w-full text-base disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send Reset Code"}
          </motion.button>

          <p className="text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link
              href={AUTH_LINKS.signIn}
              className="font-semibold text-primary transition-colors hover:text-oryno-charcoal"
            >
              Sign In
            </Link>
          </p>
        </form>
      )}
    </AuthSplitLayout>
  );
}
