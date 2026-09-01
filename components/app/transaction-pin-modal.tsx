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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

export type TransactionPinModalMode = "confirm" | "create";

const PIN_LENGTH = 4;

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

function PinBoxes({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <InputOTP
      maxLength={PIN_LENGTH}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="numeric"
      pattern="[0-9]*"
      containerClassName="justify-center gap-2.5"
    >
      <InputOTPGroup className="gap-2.5">
        {Array.from({ length: PIN_LENGTH }).map((_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="h-14 w-12 rounded-[14px] border border-border bg-muted/40 text-lg font-semibold first:rounded-[14px] last:rounded-[14px] data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/15"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

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

  async function submit(
    pinValue = pin,
    confirmValue = confirmPin,
  ) {
    setLocalError(null);
    if (pinValue.length !== PIN_LENGTH) {
      setLocalError("PIN must be exactly 4 digits.");
      return;
    }
    if (isCreate) {
      if (confirmValue.length !== PIN_LENGTH) {
        setLocalError("Confirm your 4-digit PIN.");
        return;
      }
      if (pinValue !== confirmValue) {
        setLocalError("PINs do not match.");
        return;
      }
      await onConfirm({ pin: pinValue, isCreate: true });
      return;
    }
    await onConfirm({ pin: pinValue, isCreate: false });
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
                  ? "Set a 4-digit PIN to authorize withdrawals and protect your wallet."
                  : "Enter your 4-digit transaction PIN to confirm this withdrawal.")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="space-y-2">
            <p className="text-center text-sm font-medium text-foreground">
              {isCreate ? "New PIN" : "Transaction PIN"}
            </p>
            <PinBoxes
              value={pin}
              onChange={(value) => {
                setPin(value);
                setLocalError(null);
              }}
              onComplete={
                isCreate ? undefined : (value) => void submit(value)
              }
              disabled={loading}
              autoFocus
            />
          </div>

          {isCreate ? (
            <div className="space-y-2">
              <p className="text-center text-sm font-medium text-foreground">
                Confirm PIN
              </p>
              <PinBoxes
                value={confirmPin}
                onChange={(value) => {
                  setConfirmPin(value);
                  setLocalError(null);
                }}
                onComplete={(value) => {
                  if (pin.length === PIN_LENGTH) {
                    void submit(pin, value);
                  }
                }}
                disabled={loading || pin.length < PIN_LENGTH}
              />
            </div>
          ) : null}

          {localError || error ? (
            <p className="text-center text-sm font-medium text-destructive">
              {localError || error}
            </p>
          ) : null}

          {!isCreate ? (
            <p className="text-center text-xs text-muted-foreground">
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
              disabled={
                loading ||
                pin.length !== PIN_LENGTH ||
                (isCreate && confirmPin.length !== PIN_LENGTH)
              }
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
