"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { PasswordField } from "@/components/auth/password-field";
import { SocialAuth } from "@/components/auth/social-auth";
import { clerkErrorMessage } from "@/lib/auth/clerk-errors";
import { syncSessionToDatabase } from "@/lib/auth/client-sync";
import { AUTH_LINKS } from "@/lib/auth-links";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

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
        await setActive({ session: result.createdSessionId });
        const sync = await syncSessionToDatabase();
        if (!sync.ok) {
          setError(sync.error ?? "Signed in, but account sync failed.");
          if (sync.code === "account_disabled") {
            router.replace("/login?error=account_disabled");
          }
          return;
        }
        const redirectUrl = searchParams.get("redirect_url");
        const safeRedirect =
          redirectUrl &&
          redirectUrl.startsWith("/") &&
          !redirectUrl.startsWith("//")
            ? redirectUrl
            : "/dashboard";
        router.replace(safeRedirect);
        return;
      }

      // OAuth/transfer or incomplete sign-in that became a sign-up
      if (
        result.status === "needs_new_password" ||
        result.status === "needs_first_factor" ||
        result.status === "needs_second_factor"
      ) {
        setError(
          result.status === "needs_second_factor"
            ? "Additional verification is required. Check your email or authenticator app."
            : "Additional steps are required to finish signing in.",
        );
        return;
      }

      // Missing profile fields after identifier auth — continue page
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
          <AuthField label="Email or Phone Number">
            <input
              type="text"
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. chidi@oryno.com"
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
            className="font-semibold text-primary transition-colors hover:text-oryno-charcoal"
          >
            Create Account
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
