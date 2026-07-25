"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { KeyRound, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  ADMIN_PASSCODE,
  ADMIN_SESSION_COOKIE,
  isValidAdminPasscode,
} from "@/lib/admin-auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const authed = document.cookie
      .split(";")
      .some((part) => part.trim().startsWith(`${ADMIN_SESSION_COOKIE}=1`));
    if (authed) router.replace("/admin");
  }, [router]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!isValidAdminPasscode(passcode)) {
      setError("Incorrect passcode. Try again.");
      return;
    }

    setLoading(true);
    document.cookie = `${ADMIN_SESSION_COOKIE}=1; path=/; max-age=${60 * 60 * 12}; SameSite=Lax`;
    window.setTimeout(() => {
      router.replace("/admin");
    }, 350);
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[image:var(--app-shell-gradient)] px-5 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-oryno-orange-soft/20 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md rounded-[28px] border border-border bg-background p-6 shadow-[var(--shadow-lg)] sm:p-8"
      >
        <div className="flex items-center gap-3">
          <BrandLogo size={44} className="shadow-[var(--shadow-orange)]" />
          <div>
            <p className="text-lg font-bold tracking-tight text-foreground">
              ORYNO Admin
            </p>
            <p className="text-sm text-muted-foreground">
              Passcode access · Phase 1 console
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[18px] bg-oryno-orange-muted px-4 py-3">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            Secure admin entry
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter the admin passcode to manage users, wallets, providers,
            countries, and gateways.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-foreground">
              Admin passcode
            </span>
            <div className="mt-2 flex h-14 items-center gap-3 rounded-[16px] border border-border bg-muted/40 px-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <KeyRound
                className="h-5 w-5 shrink-0 text-muted-foreground"
                strokeWidth={1.75}
              />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={passcode}
                onChange={(e) =>
                  setPasscode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
                }
                placeholder="6-digit passcode"
                required
                className="w-full bg-transparent text-lg font-semibold tracking-[0.35em] text-foreground outline-none placeholder:text-sm placeholder:tracking-normal placeholder:font-medium placeholder:text-muted-foreground"
              />
            </div>
          </label>

          {error ? (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-[var(--oryno-error)]"
            >
              {error}
            </motion.p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Demo passcode:{" "}
              <span className="font-semibold text-foreground">
                {ADMIN_PASSCODE}
              </span>
            </p>
          )}

          <motion.button
            type="submit"
            disabled={loading || passcode.length < 6}
            whileHover={passcode.length >= 6 ? { y: -2 } : undefined}
            whileTap={passcode.length >= 6 ? { scale: 0.985 } : undefined}
            className="btn-primary h-12 w-full text-base disabled:opacity-50"
          >
            {loading ? "Unlocking…" : "Unlock admin"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
