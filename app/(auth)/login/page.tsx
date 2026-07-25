"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent } from "react";
import { motion } from "framer-motion";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { PasswordField } from "@/components/auth/password-field";
import { SocialAuth } from "@/components/auth/social-auth";
import { AUTH_LINKS } from "@/lib/auth-links";

export default function LoginPage() {
  const router = useRouter();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push("/dashboard");
  }

  return (
    <AuthSplitLayout
      title="Welcome back"
      subtitle="Sign in to access your borderless wallet."
      panelTitle="Your money, moving with you."
      panelSubtitle="Sign in to manage airtime, data, bills, and payouts from one secure wallet."
    >
      <form onSubmit={onSubmit} className="flex flex-col">
        <div className="space-y-5">
          <AuthField label="Email or Phone Number">
            <input
              type="text"
              name="identifier"
              defaultValue="chidi@oryno.com"
              autoComplete="username"
              required
              className={authInputClassName}
            />
          </AuthField>

          <div>
            <PasswordField
              label="Password"
              name="password"
              autoComplete="current-password"
              required
            />
            <div className="mt-2 flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-primary transition-colors hover:text-oryno-charcoal"
              >
                Forgot Password?
              </Link>
            </div>
          </div>
        </div>

        <motion.button
          type="submit"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.985 }}
          className="btn-primary mt-7 h-12 w-full text-base"
        >
          Sign In
        </motion.button>

        <SocialAuth className="mt-7" />

        <p className="pt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href={AUTH_LINKS.getStarted}
            className="font-semibold text-primary transition-colors hover:text-oryno-charcoal"
          >
            Create Account
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
