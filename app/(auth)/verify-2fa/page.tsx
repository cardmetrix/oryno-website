"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { AUTH_LINKS } from "@/lib/auth-links";

export default function VerifyTwoFactorPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = otp.replace(/\D/g, "");
    if (code.length < 6) {
      setError("Enter the 6-digit code from Google Authenticator.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Invalid authenticator code. Try again.");
        setOtp("");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Could not verify the code. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  if (isLoaded && !isSignedIn) {
    router.replace(AUTH_LINKS.signIn);
    return null;
  }

  return (
    <AuthSplitLayout
      title="Authenticator code"
      subtitle="Enter the 6-digit code from Google Authenticator to finish signing in."
      panelTitle="One more step to your wallet."
      panelSubtitle="Confirm the code from your authenticator app to continue."
    >
      <form onSubmit={onSubmit} className="flex flex-col">
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
          Open Google Authenticator and use the current code.
        </p>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <motion.button
          type="submit"
          disabled={!isLoaded || loading || otp.length < 6}
          whileHover={otp.length >= 6 ? { y: -2 } : undefined}
          whileTap={otp.length >= 6 ? { scale: 0.985 } : undefined}
          className="btn-primary mt-8 h-12 w-full text-base disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify & Continue"}
        </motion.button>

        <button
          type="button"
          onClick={() => void signOut({ redirectUrl: AUTH_LINKS.signIn })}
          className="mt-5 text-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Use a different account
        </button>
      </form>
    </AuthSplitLayout>
  );
}
