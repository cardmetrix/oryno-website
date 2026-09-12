"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { clerkErrorMessage } from "@/lib/auth/clerk-errors";
import { cn } from "@/lib/utils";

type SocialAuthProps = {
  className?: string;
  mode?: "signIn" | "signUp";
};

export function SocialAuth({ className, mode = "signIn" }: SocialAuthProps) {
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"oauth_google" | "oauth_apple" | null>(
    null,
  );

  const isLoaded = mode === "signUp" ? signUpLoaded : signInLoaded;

  async function startOAuth(strategy: "oauth_google" | "oauth_apple") {
    setError(null);
    setPending(strategy);

    try {
      const redirectUrl = "/sso-callback";
      const forceRedirectUrl = "/dashboard";

      if (mode === "signUp") {
        if (!signUpLoaded || !signUp) return;
        await signUp.authenticateWithRedirect({
          strategy,
          redirectUrl,
          forceRedirectUrl,
          fallbackRedirectUrl: forceRedirectUrl,
          continueSignUp: true,
        });
        return;
      }

      if (!signInLoaded || !signIn) return;
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl,
        forceRedirectUrl,
        fallbackRedirectUrl: forceRedirectUrl,
      });
    } catch (err) {
      setPending(null);
      setError(
        clerkErrorMessage(
          err,
          mode === "signUp"
            ? "Social sign-up failed. Try email instead."
            : "Social sign-in failed. Try email instead.",
        ),
      );
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-sm text-muted-foreground">or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.button
          type="button"
          disabled={!isLoaded || pending !== null}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => void startOAuth("oauth_google")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] border border-border bg-background text-sm font-semibold text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-muted disabled:opacity-60"
        >
          <GoogleIcon className="h-5 w-5" />
          {pending === "oauth_google" ? "…" : "Google"}
        </motion.button>
        <motion.button
          type="button"
          disabled={!isLoaded || pending !== null}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => void startOAuth("oauth_apple")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] border border-border bg-background text-sm font-semibold text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-muted disabled:opacity-60"
        >
          <AppleIcon className="h-5 w-5" />
          {pending === "oauth_apple" ? "…" : "Apple"}
        </motion.button>
      </div>

      {error ? (
        <p className="mt-3 text-center text-sm text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.365 1.43c0 1.14-.437 2.21-1.207 3.02-.82.87-2.16 1.54-3.3 1.45-.14-1.1.4-2.27 1.16-3.05.83-.86 2.25-1.48 3.35-1.42zM20.5 17.2c-.6 1.38-.89 1.99-1.66 3.21-1.08 1.67-2.6 3.75-4.48 3.77-1.66.03-2.09-1.08-4.35-1.07-2.26.01-2.73 1.1-4.4 1.07-1.88-.03-3.32-1.9-4.4-3.57C-.58 16.9-.84 12.48.98 9.73c1.17-1.78 3.02-2.9 4.75-2.9 1.77 0 2.88 1.1 4.35 1.1 1.42 0 2.29-1.11 4.34-1.11 1.55 0 3.19.84 4.35 2.3-3.83 2.1-3.21 7.57.73 8.08z" />
    </svg>
  );
}
