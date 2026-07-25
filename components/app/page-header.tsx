"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Defaults to /dashboard when omitted */
  backHref?: string;
  /** If true, use browser history back instead of a fixed href */
  useHistoryBack?: boolean;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  backHref = "/dashboard",
  useHistoryBack = false,
  actions,
  className,
}: PageHeaderProps) {
  const router = useRouter();

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "sticky top-0 z-30 -mx-4 mb-6 border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(247,247,249,0.88)_100%)] px-4 py-3.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {useHistoryBack ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)] transition hover:bg-muted"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
            </button>
          ) : (
            <Link
              href={backHref}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)] transition hover:bg-muted"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </motion.header>
  );
}
