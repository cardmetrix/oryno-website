"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { cn } from "@/lib/utils";

export type TransactionPinModalMode = "confirm" | "create";

type TransactionPinModalProps = {
  open: boolean;
  mode: TransactionPinModalMode;
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: {
    pin: string;
    currentPin?: string;
    isCreate: boolean;
  }) => void | Promise<void>;
};

export function TransactionPinModal({
  open,
  mode,
  title,
  description,
  confirmLabel,
  loading = false,
  error = null,
  onOpenChange,
  onConfirm,
}: TransactionPinModalProps) {
  const isCreate = mode === "create";
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPin("");
      setConfirmPin("");
      setLocalError(null);
    }
  }, [open]);

  function digitsOnly(value: string) {
    return value.replace(/\D/g, "").slice(0, 6);
  }

  async function submit() {
    setLocalError(null);
    if (pin.length < 4) {
      setLocalError("PIN must be 4–6 digits.");
      return;
    }
    if (isCreate) {
      if (pin !== confirmPin) {
        setLocalError("PINs do not match.");
        return;
      }
      await onConfirm({ pin, isCreate: true });
      return;
    }
    await onConfirm({ pin, isCreate: false });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[24px] border-border p-0 shadow-[var(--shadow-soft)] sm:max-w-md [&>button]:hidden">
        <div className="border-b border-border bg-muted/40 px-5 py-4">
          <DialogHeader className="space-y-1 text-left">
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              {title ||
                (isCreate
                  ? "Create transaction PIN"
                  : "Enter transaction PIN")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {description ||
                (isCreate
                  ? "Set a 4–6 digit PIN to authorize withdrawals and protect your wallet."
                  : "Enter your transaction PIN to confirm this withdrawal.")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-5">
          <AuthField label={isCreate ? "New PIN (4–6 digits)" : "Transaction PIN"}>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(digitsOnly(e.target.value))}
              className={authInputClassName}
              placeholder="••••"
            />
          </AuthField>

          {isCreate ? (
            <AuthField label="Confirm PIN">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={confirmPin}
                onChange={(e) => setConfirmPin(digitsOnly(e.target.value))}
                className={authInputClassName}
                placeholder="••••"
              />
            </AuthField>
          ) : null}

          {localError || error ? (
            <p className="text-sm font-medium text-destructive">
              {localError || error}
            </p>
          ) : null}

          {!isCreate ? (
            <p className="text-xs text-muted-foreground">
              Forgot your PIN?{" "}
              <Link
                href="/settings/security"
                className="font-semibold text-primary"
                onClick={() => onOpenChange(false)}
              >
                Change it in Security
              </Link>
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="btn-secondary h-11 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || pin.length < 4}
              onClick={() => void submit()}
              className={cn(
                "btn-primary inline-flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-60",
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {confirmLabel ||
                (isCreate ? "Set PIN & continue" : "Confirm")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
