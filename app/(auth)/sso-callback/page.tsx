"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SsoCallbackPage() {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center gap-4 bg-background px-6">
      <AuthenticateWithRedirectCallback
        signInUrl="/login"
        signUpUrl="/register"
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
        continueSignUpUrl="/continue"
      />
      {/* Required when Clerk bot protection is enabled */}
      <div id="clerk-captcha" />
      <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
    </div>
  );
}
