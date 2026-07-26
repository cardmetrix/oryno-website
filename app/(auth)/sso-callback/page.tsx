"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export default function SsoCallbackPage() {
  return (
    <div className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-background px-6">
      <AuthenticateWithRedirectCallback
        signInUrl="/login"
        signUpUrl="/register"
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
        continueSignUpUrl="/continue"
      />
      {/* Required when Clerk bot protection is enabled */}
      <div id="clerk-captcha" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,106,0,0.16),transparent_55%)]"
      />

      <motion.div
        role="status"
        aria-live="polite"
        aria-label="Finishing sign-in"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[320px]"
      >
        <div className="flex flex-col items-center">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <Skeleton className="mt-5 h-5 w-28 rounded-full" />
          <Skeleton className="mt-2.5 h-3.5 w-44 rounded-full" />
        </div>

        <div className="mt-8 space-y-3 rounded-[22px] border border-border bg-background/80 p-4 shadow-[var(--shadow-soft)] backdrop-blur-sm">
          <Skeleton className="h-11 w-full rounded-[14px]" />
          <Skeleton className="h-11 w-full rounded-[14px]" />
          <Skeleton className="mx-auto h-3 w-36 rounded-full" />
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Finishing sign-in…
        </p>
      </motion.div>
    </div>
  );
}
