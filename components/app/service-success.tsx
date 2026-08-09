"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  Headphones,
  Home,
  Plus,
  Share2,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ServiceSuccessAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: "receipt" | "share" | "plus" | "home" | "again";
};

export type ServiceSuccessProps = {
  variant?: "success" | "pending";
  title: string;
  subtitle: string;
  amountLabel?: string;
  amount?: string | null;
  reference?: string | null;
  primaryAction?: ServiceSuccessAction | null;
  secondaryAction?: ServiceSuccessAction | null;
  tertiaryAction?: ServiceSuccessAction | null;
  showFooter?: boolean;
  confetti?: boolean;
  children?: ReactNode;
  className?: string;
};

const CONFETTI_COLORS = ["#34C759", "#FF6A00", "#FFFFFF", "#FF8C42", "#A7F3D0"];

function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: 18 + Math.random() * 64,
        delay: Math.random() * 0.35,
        duration: 1.4 + Math.random() * 0.9,
        size: 4 + Math.random() * 6,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        x: (Math.random() - 0.5) * 140,
        shape: i % 3 === 0 ? "round" : "rect",
      })),
    [],
  );

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-48 overflow-visible"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-16"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.shape === "round" ? p.size : p.size * 0.45,
            borderRadius: p.shape === "round" ? 999 : 2,
            backgroundColor: p.color,
          }}
          initial={{ opacity: 0, y: 0, x: 0, rotate: 0, scale: 0.4 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [0, -18, 90 + Math.random() * 40],
            x: [0, p.x * 0.4, p.x],
            rotate: [0, p.rotate, p.rotate + 120],
            scale: [0.4, 1, 0.85],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      ))}
    </div>
  );
}

function ActionButton({
  action,
  variant,
}: {
  action: ServiceSuccessAction;
  variant: "primary" | "secondary";
}) {
  const icon =
    action.icon === "receipt" ? (
      <FileText className="h-4 w-4" strokeWidth={1.75} />
    ) : action.icon === "share" ? (
      <Share2 className="h-4 w-4" strokeWidth={1.75} />
    ) : action.icon === "plus" ? (
      <Plus className="h-4 w-4" strokeWidth={2} />
    ) : action.icon === "home" ? (
      <Home className="h-4 w-4" strokeWidth={1.75} />
    ) : null;

  const className = cn(
    "group inline-flex h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-sm font-semibold transition",
    variant === "primary"
      ? "bg-primary text-primary-foreground shadow-[0_10px_28px_rgba(255,106,0,0.28)] hover:brightness-105"
      : "border border-border bg-muted/50 text-foreground hover:bg-muted",
  );

  const content = (
    <>
      <span className="inline-flex items-center gap-2.5">
        {icon}
        {action.label}
      </span>
      {action.icon === "plus" ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-background/40">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
      )}
    </>
  );

  if (action.href) {
    return (
      <Link href={action.href} onClick={action.onClick} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {content}
    </button>
  );
}

export function ServiceSuccess({
  variant = "success",
  title,
  subtitle,
  amountLabel,
  amount,
  reference,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  showFooter = true,
  confetti,
  children,
  className,
}: ServiceSuccessProps) {
  const isSuccess = variant === "success";
  const showConfetti = confetti ?? isSuccess;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copyReference() {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      toast.success("Reference copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-border bg-background px-4 py-7 text-center shadow-[var(--shadow-soft)] sm:px-6 sm:py-9",
        className,
      )}
    >
      <ConfettiBurst active={showConfetti} />

      <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
        <motion.span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full",
            isSuccess ? "bg-[var(--oryno-success)]/20" : "bg-amber-500/15",
          )}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: [0.85, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 16 }}
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg",
            isSuccess
              ? "bg-[var(--oryno-success)] shadow-[0_12px_32px_rgba(52,199,89,0.35)]"
              : "bg-amber-500 shadow-[0_12px_32px_rgba(245,158,11,0.3)]",
          )}
        >
          {isSuccess ? (
            <Check className="h-8 w-8" strokeWidth={2.5} />
          ) : (
            <Clock3 className="h-7 w-7" strokeWidth={2} />
          )}
        </motion.span>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mt-5 text-2xl font-bold tracking-tight text-foreground"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground"
      >
        {subtitle}
      </motion.p>

      {amount || reference ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mt-6 overflow-hidden rounded-2xl border border-border bg-muted/40 text-left"
        >
          {amount ? (
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  isSuccess
                    ? "bg-[var(--oryno-success)]/15 text-[var(--oryno-success)]"
                    : "bg-amber-500/15 text-amber-600",
                )}
              >
                <Wallet className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                  {amountLabel ||
                    (isSuccess ? "Amount credited" : "Expected amount")}
                </p>
                <p className="truncate text-xl font-bold tabular-nums text-foreground">
                  {amount}
                </p>
              </div>
            </div>
          ) : null}

          {amount && reference ? (
            <div className="border-t border-border/80" />
          ) : null}

          {reference ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Reference ID</p>
                <p className="truncate font-mono text-sm font-semibold text-foreground">
                  {reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyReference()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-[var(--oryno-success)] transition hover:bg-muted"
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          ) : null}
        </motion.div>
      ) : null}

      {children ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="mt-4 text-left"
        >
          {children}
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32 }}
        className="mt-6 space-y-2.5"
      >
        {primaryAction ? (
          <ActionButton action={primaryAction} variant="primary" />
        ) : null}
        {secondaryAction ? (
          <ActionButton action={secondaryAction} variant="secondary" />
        ) : null}
        {tertiaryAction ? (
          <ActionButton action={tertiaryAction} variant="secondary" />
        ) : null}
      </motion.div>

      {showFooter ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-7 grid grid-cols-2 gap-3 border-t border-border pt-4 text-left"
        >
          <div className="flex items-start gap-2.5">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--oryno-success)]"
              strokeWidth={1.75}
            />
            <div>
              <p className="text-xs font-bold text-[var(--oryno-success)]">
                100% Secure
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Your transactions are protected
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 border-l border-border pl-3">
            <Headphones
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--oryno-success)]"
              strokeWidth={1.75}
            />
            <div>
              <p className="text-xs font-bold text-foreground">Need help?</p>
              <Link
                href="/support"
                className="mt-0.5 inline-block text-[11px] font-semibold text-[var(--oryno-success)]"
              >
                Contact support
              </Link>
            </div>
          </div>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
