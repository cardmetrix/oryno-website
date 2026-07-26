"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Checkbox } from "@/components/ui/checkbox";
import { applyMissingSignUpFields } from "@/lib/auth/complete-signup";
import { clerkErrorMessage } from "@/lib/auth/clerk-errors";
import { syncSessionToDatabase } from "@/lib/auth/client-sync";
import {
  isValidUsername,
  normalizeUsername,
} from "@/lib/auth/username";
import { AUTH_LINKS } from "@/lib/auth-links";

export default function ContinuePage() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const missing = useMemo(
    () => new Set(signUp?.missingFields ?? []),
    [signUp?.missingFields],
  );

  useEffect(() => {
    if (!isLoaded) return;

    if (signUp?.status === "complete" && signUp.createdSessionId && setActive) {
      void (async () => {
        await setActive({ session: signUp.createdSessionId });
        await syncSessionToDatabase();
        router.replace("/dashboard");
      })();
      return;
    }

    try {
      const raw = sessionStorage.getItem("oryno_pending_verify");
      if (raw) {
        const stored = JSON.parse(raw) as {
          username?: string;
          fullName?: string;
          phone?: string;
        };
        if (stored.username) setUsername(stored.username);
        if (stored.fullName) setFullName(stored.fullName);
        if (stored.phone) setPhone(stored.phone);
      }
    } catch {
      // ignore
    }

    if (signUp?.username) setUsername(signUp.username);
    const name = [signUp?.firstName, signUp?.lastName].filter(Boolean).join(" ");
    if (name) setFullName(name);
    if (signUp?.phoneNumber) setPhone(signUp.phoneNumber);
  }, [isLoaded, signUp, setActive, router]);

  const needsPhone = missing.has("phone_number");

  const canSubmit =
    agreed &&
    isLoaded &&
    !loading &&
    Boolean(signUp) &&
    isValidUsername(normalizeUsername(username)) &&
    fullName.trim().length >= 2 &&
    (!needsPhone || phone.trim().length >= 7);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp || !setActive || !canSubmit) return;

    setError(null);
    setLoading(true);

    try {
      const result = await applyMissingSignUpFields(signUp, {
        username: normalizeUsername(username),
        fullName: fullName.trim(),
        phone: phone.trim(),
        legalAccepted: agreed,
      });

      if (result.status === "complete") {
        const sessionId =
          (result as { createdSessionId?: string | null }).createdSessionId ??
          signUp.createdSessionId;
        if (!sessionId) {
          throw new Error("Account ready, but no session was created.");
        }
        await setActive({ session: sessionId });
        const sync = await syncSessionToDatabase();
        sessionStorage.removeItem("oryno_pending_verify");
        if (!sync.ok) {
          throw new Error(sync.error ?? "Sync failed after sign-up.");
        }
        router.replace("/dashboard");
        return;
      }

      const stillMissing = (result.missingFields ?? []).join(", ");
      setError(
        stillMissing
          ? `Still need: ${stillMissing.replace(/_/g, " ")}.`
          : "Could not finish account setup. Try again.",
      );
    } catch (err) {
      setError(
        clerkErrorMessage(err, "Could not finish account setup. Try again."),
      );
    } finally {
      setLoading(false);
    }
  }

  if (isLoaded && !signUp) {
    return (
      <AuthSplitLayout
        title="Continue setup"
        subtitle="Start from sign in or create account."
        panelTitle="Almost there."
        panelSubtitle="We’ll finish collecting anything still needed for your wallet."
      >
        <p className="text-sm text-muted-foreground">
          No active sign-up was found. Please sign in again or create a new
          account.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={AUTH_LINKS.signIn}
            className="btn-primary h-12 text-center text-base leading-[3rem]"
          >
            Sign in
          </Link>
          <Link
            href={AUTH_LINKS.getStarted}
            className="btn-secondary h-12 text-center text-base leading-[3rem]"
          >
            Create account
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      title="Additional information"
      subtitle="A few details are required to finish creating your ORYNO account."
      panelTitle="Complete your profile."
      panelSubtitle="Username and name help secure your wallet and make transfers easier."
    >
      <form onSubmit={onSubmit} className="flex flex-col">
        <div className="space-y-4">
          <AuthField label="Full Name">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Chidi Benson"
              autoComplete="name"
              required
              className={authInputClassName}
            />
          </AuthField>

          <AuthField label="Username">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. chidi_b"
              autoComplete="username"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              className={authInputClassName}
            />
          </AuthField>

          {needsPhone ? (
            <AuthField label="Phone Number">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +234 801 234 5678"
                autoComplete="tel"
                required
                className={authInputClassName}
              />
            </AuthField>
          ) : null}
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            className="mt-0.5 h-5 w-5 rounded-[6px] border-primary data-[state=checked]:bg-primary"
          />
          <span>
            I agree to the{" "}
            <span className="font-semibold text-primary">Terms</span> &{" "}
            <span className="font-semibold text-primary">Privacy Policy</span>
          </span>
        </label>

        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}

        <motion.button
          type="submit"
          disabled={!canSubmit}
          whileHover={canSubmit ? { y: -2 } : undefined}
          whileTap={canSubmit ? { scale: 0.985 } : undefined}
          className="btn-primary mt-6 h-12 w-full text-base disabled:opacity-50"
        >
          {loading ? "Finishing…" : "Continue"}
        </motion.button>

        <div id="clerk-captcha" className="mt-4" />
      </form>
    </AuthSplitLayout>
  );
}
