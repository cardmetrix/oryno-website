"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AUTH_LINKS } from "@/lib/auth-links";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <AuthSplitLayout
      title="Forgot Password"
      subtitle="Enter your email and we’ll send a reset link to get you back in."
      panelTitle="Secure access, always."
      panelSubtitle="Reset your password in seconds and get back to your wallet, airtime, and bills."
      top={
        <Link
          href={AUTH_LINKS.signIn}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to Sign In
        </Link>
      }
    >
      {sent ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-[16px] border border-border bg-muted/50 p-5"
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
            <MailCheck className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <p className="text-base font-semibold text-foreground">
            Check your email
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            If an account exists for that email, a reset link has been sent.
            Check your inbox and spam folder.
          </p>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }}>
            <Link
              href={AUTH_LINKS.signIn}
              className="btn-primary mt-6 inline-flex h-12 w-full items-center justify-center text-base"
            >
              Return to Sign In
            </Link>
          </motion.div>
        </motion.div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
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

          <motion.button
            type="submit"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.985 }}
            className="btn-primary h-12 w-full text-base"
          >
            Send Reset Link
          </motion.button>

          <p className="text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link
              href={AUTH_LINKS.signIn}
              className="font-semibold text-primary transition-colors hover:text-oryno-charcoal"
            >
              Sign In
            </Link>
          </p>
        </form>
      )}
    </AuthSplitLayout>
  );
}
