"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { PasswordField } from "@/components/auth/password-field";
import { SocialAuth } from "@/components/auth/social-auth";
import { Checkbox } from "@/components/ui/checkbox";
import { AUTH_LINKS } from "@/lib/auth-links";

export default function RegisterPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(true);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agreed) return;
    router.push("/otp");
  }

  return (
    <AuthSplitLayout
      title="Create Account"
      subtitle="Join ORYNO and enjoy simplified digital services."
      panelTitle="Start with a borderless wallet."
      panelSubtitle="Create your account to fund, send, and pay for airtime, data, and bills in one place."
    >
      <form onSubmit={onSubmit} className="flex flex-col">
        <div className="space-y-4">
          <AuthField label="Full Name">
            <input
              type="text"
              name="fullName"
              placeholder="e.g. Chidi Benson"
              autoComplete="name"
              required
              className={authInputClassName}
            />
          </AuthField>

          <AuthField label="Email Address">
            <input
              type="email"
              name="email"
              placeholder="e.g. chidi@oryno.com"
              autoComplete="email"
              required
              className={authInputClassName}
            />
          </AuthField>

          <AuthField label="Phone Number">
            <input
              type="tel"
              name="phone"
              placeholder="e.g. +234 801 234 5678"
              autoComplete="tel"
              required
              className={authInputClassName}
            />
          </AuthField>

          <PasswordField
            label="Password"
            name="password"
            placeholder="Create robust password"
            autoComplete="new-password"
            required
          />

          <PasswordField
            label="Confirm Password"
            name="confirmPassword"
            placeholder="Repeat password"
            autoComplete="new-password"
            required
          />
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
          <Checkbox
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            className="mt-0.5 h-5 w-5 rounded-[6px] border-primary data-[state=checked]:bg-primary"
          />
          <span>
            I agree to the{" "}
            <Link href="#" className="font-semibold text-primary">
              Terms of Service
            </Link>{" "}
            &{" "}
            <Link href="#" className="font-semibold text-primary">
              Privacy Policy
            </Link>
          </span>
        </label>

        <motion.button
          type="submit"
          disabled={!agreed}
          whileHover={agreed ? { y: -2 } : undefined}
          whileTap={agreed ? { scale: 0.985 } : undefined}
          className="btn-primary mt-6 h-12 w-full text-base disabled:opacity-50"
        >
          Create Account
        </motion.button>

        <SocialAuth className="mt-7" />

        <p className="pt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href={AUTH_LINKS.signIn}
            className="font-semibold text-primary transition-colors hover:text-oryno-charcoal"
          >
            Sign In
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
