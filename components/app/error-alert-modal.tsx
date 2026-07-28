"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Headphones, Loader2, Mail, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ErrorAlertModalProps = {
  error: string | null;
  onClose: () => void;
  /** Short context shown in the modal and support email subject */
  page?: string;
  className?: string;
};

export function ErrorAlertModal({
  error,
  onClose,
  page = "ORYNO",
  className,
}: ErrorAlertModalProps) {
  const open = Boolean(error);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNote("");
      setSending(false);
      setSent(false);
      setSendError(null);
    }
  }, [open]);

  async function contactSupport() {
    if (!error || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/support/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorMessage: error,
          page,
          userNote: note.trim() || undefined,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to contact support");
      setSent(true);
    } catch (e) {
      // Fallback: open mail client with prefilled error report
      const support = "support@oryno.com";
      const subject = encodeURIComponent(`[ORYNO Error] ${page}`);
      const body = encodeURIComponent(
        [
          "Hi ORYNO Support,",
          "",
          "I ran into an error in the app:",
          error,
          "",
          note.trim() ? `Additional details:\n${note.trim()}\n` : "",
          `Page: ${page}`,
          typeof window !== "undefined" ? `URL: ${window.location.href}` : "",
          "",
          "Thanks,",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      window.location.href = `mailto:${support}?subject=${subject}&body=${body}`;
      setSendError(
        e instanceof Error
          ? `${e.message}. Opening your email app instead…`
          : "Opening your email app instead…",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className={cn(
          "max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[24px] border-border p-0 shadow-[var(--shadow-soft)] sm:max-w-md [&>button]:hidden",
          className,
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="relative px-5 pt-5 pb-2 sm:px-6 sm:pt-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>

          <DialogHeader className="pr-10 text-left">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertTriangle className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Something went wrong
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {page} couldn’t complete that action. You can dismiss this or
              contact ORYNO support with the details below.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-3 sm:px-6">
          <div className="rounded-[16px] border border-red-100 bg-red-50/80 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-red-700/80 uppercase">
              Error details
            </p>
            <p className="mt-1 text-sm leading-relaxed font-medium break-words text-red-700">
              {error}
            </p>
          </div>

          {sent ? (
            <div className="rounded-[16px] border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Report sent to ORYNO support. We’ll reply to your account email
              soon.
            </div>
          ) : (
            <label className="block">
              <span className="text-sm font-semibold text-foreground">
                Add a note (optional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="What were you trying to do?"
                className="mt-2 w-full resize-none rounded-[14px] border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
          )}

          {sendError ? (
            <p className="text-xs text-muted-foreground">{sendError}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:px-6">
          {!sent ? (
            <button
              type="button"
              onClick={() => void contactSupport()}
              disabled={sending}
              className="btn-primary inline-flex h-11 flex-1 items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Headphones className="h-4 w-4" strokeWidth={1.75} />
                  Contact ORYNO support
                </>
              )}
            </button>
          ) : (
            <a
              href="mailto:support@oryno.com"
              className="btn-secondary inline-flex h-11 flex-1 items-center justify-center gap-2 text-sm"
            >
              <Mail className="h-4 w-4" strokeWidth={1.75} />
              Email support@oryno.com
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary inline-flex h-11 flex-1 items-center justify-center text-sm sm:max-w-[120px]"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
