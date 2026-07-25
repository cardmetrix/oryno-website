"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
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
    if (seconds <= 0) return;
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  const destination = useMemo(() => {
    if (pending.email) {
      const [user, domain] = pending.email.split("@");
      if (!domain) return pending.email;
      const masked =
        user.length <= 2
          ? `${user[0] ?? "*"}***`
          : `${user.slice(0, 2)}***`;
      return `${masked}@${domain}`;
    }
    return "your email";
  }, [pending.email]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !signUp || !setActive || value.length < 6) return;

    setError(null);
    setLoading(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: value,
      });

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

      setError("Verification incomplete. Please try again.");
    } catch (err) {
      setError(clerkErrorMessage(err, "Invalid or expired code."));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!isLoaded || !signUp) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setSeconds(54);
    } catch (err) {
      setError(clerkErrorMessage(err, "Could not resend the code."));
    }
  }

  return (
    <AuthShell>
      <Link
        href="/register"
        className="mb-6 inline-flex items-center gap-2 text-base font-semibold text-foreground"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        OTP Verification
      </Link>

      <div className="mb-8">
        <h1 className="text-[2rem] font-bold tracking-tight text-foreground">
          Verify your email
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          We&apos;ve sent a 6-digit verification code to {destination}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <InputOTP
          maxLength={6}
          value={value}
          onChange={setValue}
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
          disabled={!isLoaded || loading || value.length < 6}
          className="btn-primary mt-8 h-12 w-full text-base disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify & Proceed"}
        </button>
      </form>
    </AuthShell>
  );
}
