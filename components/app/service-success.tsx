"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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
  /** @deprecated Confetti removed — ignored. */
  confetti?: boolean;
  onDismiss?: () => void;
  children?: ReactNode;
  className?: string;
};

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
  onDismiss,
  children,
  className,
}: ServiceSuccessProps) {
  const isSuccess = variant === "success";
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOpen(true);
  }, [title, reference, amount]);

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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onDismiss?.();
      }}
    >
      <DialogContent
        className={cn(
          "max-w-md gap-0 overflow-y-auto rounded-[28px] border-border px-5 pt-2 pb-5 text-center sm:px-7 sm:pt-3 sm:pb-7 [&>button]:top-3",
          className,
        )}
      >
        <div className="relative -mt-1 mx-auto flex h-20 w-20 items-center justify-center">
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full",
              isSuccess ? "bg-[var(--oryno-success)]/20" : "bg-amber-500/15",
            )}
          />
          <span
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
          </span>
        </div>

        <DialogTitle className="mt-3 text-2xl font-bold tracking-tight text-foreground">
          {title}
        </DialogTitle>
        <DialogDescription className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {subtitle}
        </DialogDescription>

        {amount || reference ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-muted/40 text-left">
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
          </div>
        ) : null}

        {children ? <div className="mt-4 text-left">{children}</div> : null}

        <div className="mt-6 space-y-2.5">
          {primaryAction ? (
            <ActionButton action={primaryAction} variant="primary" />
          ) : null}
          {secondaryAction ? (
            <ActionButton action={secondaryAction} variant="secondary" />
          ) : null}
          {tertiaryAction ? (
            <ActionButton action={tertiaryAction} variant="secondary" />
          ) : null}
        </div>

        {showFooter ? (
          <div className="mt-7 grid grid-cols-2 gap-3 border-t border-border pt-4 text-left">
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
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
