"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

type MeResponse = {
  ok?: boolean;
  signedIn?: boolean;
  isAdmin?: boolean;
  canBootstrap?: boolean;
  session?: boolean;
  email?: string;
  reason?: string;
  admin?: { name: string; email: string; role: string };
  error?: string;
};

export default function AdminLoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/auth/me", { cache: "no-store" });
        const data = (await res.json()) as MeResponse;
        if (cancelled) return;
        setMe(data);
        if (data.session && data.isAdmin) {
          router.replace("/admin");
          return;
        }
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unlock admin");
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock admin");
    } finally {
      setLoading(false);
    }
  }

  const email =
    me?.email ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    "";

  const denied =
    isSignedIn &&
    me &&
    !me.isAdmin &&
    !me.canBootstrap &&
    me.reason !== "inactive";

  const inactive = me?.reason === "inactive";

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
              Clerk account + admin passcode
            </p>
          </div>
        </div>

        {!isLoaded || checking ? (
          <div className="mt-8 flex justify-center py-10">
            <div className="h-10 w-10 animate-pulse rounded-full bg-oryno-orange-muted" />
          </div>
        ) : !isSignedIn ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-[18px] bg-oryno-orange-muted px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
                Sign in required
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Only signed-in users with an admin role can unlock the console.
              </p>
            </div>
            <Link
              href="/login?redirect_url=/admin/login"
              className="btn-primary flex h-12 w-full items-center justify-center text-base"
            >
              Sign in to continue
            </Link>
          </div>
        ) : denied || inactive ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-[18px] border border-border bg-muted/40 px-4 py-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--oryno-error)]">
                <ShieldAlert className="h-4 w-4" strokeWidth={1.75} />
                {inactive ? "Admin disabled" : "Not an admin"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {inactive
                  ? "This admin account has been deactivated."
                  : "Your account is not an admin. Ask a super admin to add your email to the admins list."}
              </p>
              {email ? (
                <p className="mt-2 text-xs font-semibold text-foreground">
                  Signed in as {email}
                </p>
              ) : null}
            </div>
            <Link
              href="/dashboard"
              className="btn-secondary flex h-12 w-full items-center justify-center text-base"
            >
              Back to app
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-[18px] bg-oryno-orange-muted px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
                Secure admin entry
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {me?.canBootstrap
                  ? "Your email is on the admin allowlist. Enter the passcode to create your admin access."
                  : "Enter the admin passcode to unlock the console."}
              </p>
              {email ? (
                <p className="mt-2 text-xs font-semibold text-foreground">
                  {email}
                  {me?.admin?.role ? ` · ${me.admin.role}` : ""}
                </p>
              ) : null}
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
                    autoComplete="current-password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter passcode"
                    required
                    className="w-full bg-transparent text-base font-semibold tracking-wide text-foreground outline-none placeholder:text-sm placeholder:tracking-normal placeholder:font-medium placeholder:text-muted-foreground"
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
                  Passcode is set with{" "}
                  <span className="font-semibold text-foreground">
                    ADMIN_PASSCODE
                  </span>{" "}
                  on the server.
                </p>
              )}

              <motion.button
                type="submit"
                disabled={loading || passcode.length < 4}
                whileHover={passcode.length >= 4 ? { y: -2 } : undefined}
                whileTap={passcode.length >= 4 ? { scale: 0.985 } : undefined}
                className="btn-primary h-12 w-full text-base disabled:opacity-50"
              >
                {loading ? "Unlocking…" : "Unlock admin"}
              </motion.button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
