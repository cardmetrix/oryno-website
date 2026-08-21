"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, KeyRound, Loader2, Shield } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

type SecurityState = {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  hasPin: boolean;
};

export default function SecurityPage() {
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPinForm, setShowPinForm] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [showDisableTotp, setShowDisableTotp] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const totpOn = Boolean(security?.twoFactorEnabled);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setSecurity(json.security);
    } catch {
      toast.error("Could not load security settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setSecurity(json.security);
      if (!("pin" in body) && !("twoFactorEnabled" in body)) {
        toast.success("Security updated");
      }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function savePin() {
    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }
    const ok = await patch({
      pin,
      currentPin: security?.hasPin ? currentPin : undefined,
    });
    if (ok) {
      toast.success(
        security?.hasPin
          ? "Transaction PIN changed"
          : "Transaction PIN created",
      );
      setShowPinForm(false);
      setCurrentPin("");
      setPin("");
      setConfirmPin("");
    }
  }

  function onToggle2fa(next: boolean) {
    if (next) {
      setShowTotp(true);
      return;
    }
    setShowDisableTotp(true);
  }

  return (
    <AppShell>
      <PageHeader
        title="Security Settings"
        subtitle="Google Authenticator 2FA and transaction PIN"
        backHref="/settings"
      />

      {loading || !security ? (
        <MotionSection className="space-y-3 rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[14px]" />
          ))}
        </MotionSection>
      ) : (
        <>
          <MotionSection className="space-y-3 rounded-[28px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]">
            <SecurityRow
              icon={Shield}
              title="Google Authenticator"
              subtitle={
                totpOn
                  ? "Required at every sign-in"
                  : "Add an authenticator app for 2FA"
              }
              checked={totpOn}
              disabled={saving}
              onCheckedChange={onToggle2fa}
            />

            <div className="flex items-center justify-between rounded-[16px] bg-muted/50 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Transaction PIN
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {security.hasPin ? "PIN is active" : "Not set yet"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPinForm((v) => !v)}
                className="text-xs font-bold text-primary"
              >
                {security.hasPin ? "Change" : "Set PIN"}
              </button>
            </div>
          </MotionSection>

          {showPinForm ? (
            <MotionSection
              delay={0.06}
              className="mt-4 space-y-4 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <p className="text-sm font-semibold text-foreground">
                {security.hasPin
                  ? "Change transaction PIN"
                  : "Create transaction PIN"}
              </p>
              {security.hasPin ? (
                <AuthField label="Current PIN">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={currentPin}
                    onChange={(e) =>
                      setCurrentPin(e.target.value.replace(/\D/g, ""))
                    }
                    className={authInputClassName}
                  />
                </AuthField>
              ) : null}
              <AuthField label="New PIN (4–6 digits)">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className={authInputClassName}
                />
              </AuthField>
              <AuthField label="Confirm PIN">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(e.target.value.replace(/\D/g, ""))
                  }
                  className={authInputClassName}
                />
              </AuthField>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPinForm(false)}
                  className="btn-secondary h-11 text-sm"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={saving || pin.length < 4}
                  onClick={() => void savePin()}
                  className="btn-primary inline-flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save PIN
                </motion.button>
              </div>
            </MotionSection>
          ) : null}
        </>
      )}

      <TotpSetupDialog
        open={showTotp}
        onOpenChange={setShowTotp}
        onEnabled={() => {
          setSecurity((prev) =>
            prev ? { ...prev, twoFactorEnabled: true } : prev,
          );
        }}
      />

      <TotpDisableDialog
        open={showDisableTotp}
        onOpenChange={setShowDisableTotp}
        onDisabled={() => {
          setSecurity((prev) =>
            prev ? { ...prev, twoFactorEnabled: false } : prev,
          );
        }}
      />
    </AppShell>
  );
}

function TotpSetupDialog({
  open,
  onOpenChange,
  onEnabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnabled: () => void;
}) {
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [started, setStarted] = useState(false);

  function reset() {
    setSecret("");
    setUri("");
    setCode("");
    setStarted(false);
  }

  async function startEnrollment() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/2fa/setup", { method: "POST" });
      const json = (await res.json()) as {
        error?: string;
        secret?: string;
        uri?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not start authenticator setup");
      setSecret(json.secret || "");
      setUri(json.uri || "");
      setStarted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start authenticator setup");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (code.length < 6) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/settings/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Invalid authenticator code");
      toast.success("2FA enabled", {
        description: "Google Authenticator is now required at sign-in.",
      });
      reset();
      onEnabled();
      onOpenChange(false);
    } catch (err) {
      setCode("");
      toast.error(err instanceof Error ? err.message : "Invalid authenticator code");
    } finally {
      setVerifying(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    toast.success("Secret copied");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex w-[calc(100%-1.25rem)] max-w-md max-h-[min(92svh,720px)] flex-col gap-0 overflow-hidden rounded-[24px] border-border p-0 shadow-[var(--shadow-soft)] sm:w-full">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border bg-muted/40 px-4 py-4 pr-12 text-left sm:px-6">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <DialogTitle className="text-base font-bold sm:text-lg">
            Google Authenticator
          </DialogTitle>
          <DialogDescription className="text-xs leading-5 sm:text-sm">
            Scan the QR code in Google Authenticator, then enter the 6-digit
            code to finish.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
          {!started ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => void startEnrollment()}
              className="btn-primary inline-flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Generate QR code
            </button>
          ) : (
            <div className="flex flex-col gap-4 sm:gap-5">
              <div className="flex justify-center">
                <div className="flex size-[168px] items-center justify-center rounded-[20px] border border-border bg-white p-3 sm:size-[196px] sm:p-4">
                  {uri ? (
                    <QRCodeSVG
                      value={uri}
                      size={164}
                      className="size-[144px] sm:size-[164px]"
                    />
                  ) : (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  )}
                </div>
              </div>

              {secret ? (
                <button
                  type="button"
                  onClick={() => void copySecret()}
                  className="flex w-full items-start gap-3 rounded-2xl bg-muted/50 px-3 py-3 text-left sm:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                      Can’t scan? Enter this key
                    </p>
                    <p className="mt-1 break-all font-mono text-xs font-semibold leading-5 sm:text-sm">
                      {secret}
                    </p>
                  </div>
                  <Copy className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                </button>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  Enter the 6-digit code
                </p>
                <TotpCodeInput value={code} onChange={setCode} />
              </div>

              <button
                type="button"
                disabled={verifying || code.length < 6}
                onClick={() => void verify()}
                className="btn-primary inline-flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enable 2FA
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TotpDisableDialog({
  open,
  onOpenChange,
  onDisabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisabled: () => void;
}) {
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function disable() {
    if (code.length < 6) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not disable 2FA");
      toast.success("2FA disabled");
      setCode("");
      onDisabled();
      onOpenChange(false);
    } catch (err) {
      setCode("");
      toast.error(err instanceof Error ? err.message : "Could not disable 2FA");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setCode("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex w-[calc(100%-1.25rem)] max-w-md max-h-[min(92svh,720px)] flex-col gap-0 overflow-hidden rounded-[24px] border-border p-0 shadow-[var(--shadow-soft)] sm:w-full">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border bg-muted/40 px-4 py-4 pr-12 text-left sm:px-6">
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <DialogTitle className="text-base font-bold sm:text-lg">
            Turn off Google Authenticator
          </DialogTitle>
          <DialogDescription className="text-xs leading-5 sm:text-sm">
            Enter the current 6-digit code to confirm. It will no longer be
            required at sign-in.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
          <TotpCodeInput value={code} onChange={setCode} />
          <button
            type="button"
            disabled={saving || code.length < 6}
            onClick={() => void disable()}
            className="btn-primary inline-flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Turn off 2FA
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TotpCodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={onChange}
      containerClassName="w-full justify-center"
    >
      <InputOTPGroup className="flex w-full max-w-[360px] justify-between gap-1.5 sm:gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className="h-11 min-w-0 flex-1 rounded-[12px] border border-border text-base first:rounded-[12px] last:rounded-[12px] sm:h-12"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

function SecurityRow({
  icon: Icon,
  title,
  subtitle,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-[16px] bg-muted/50 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <Switch
        checked={Boolean(checked)}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
