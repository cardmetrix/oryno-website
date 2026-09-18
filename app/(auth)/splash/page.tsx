"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/brand-logo";
import { AUTH_LINKS } from "@/lib/auth-links";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace(AUTH_LINKS.signIn);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,106,0,0.18),transparent_55%)]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col items-center gap-5 px-6 text-center"
      >
        <BrandLogo size={88} priority className="shadow-[var(--shadow-orange-lg)]" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            ORYNO
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your Digital World, Simplified.
          </p>
        </div>
        <motion.div
          className="mt-4 h-1.5 w-28 overflow-hidden rounded-full bg-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.8, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
