"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

export default function OtpPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [seconds, setSeconds] = useState(54);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (value.length < 6) return;
    router.push("/dashboard");
  }

  const mm = String(Math.floor(seconds / 60));
  const ss = String(seconds % 60).padStart(2, "0");

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
          Verify your phone
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          We&apos;ve sent a 6-digit verification code to +234 ••• ••• 5678
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
              Resend in {mm}:{ss}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setSeconds(54)}
              className="font-semibold text-primary"
            >
              Resend
            </button>
          )}
        </p>

        <button
          type="submit"
          disabled={value.length < 6}
          className="btn-primary mt-8 h-12 w-full text-base disabled:opacity-50"
        >
          Verify & Proceed
        </button>
      </form>
    </AuthShell>
  );
}
