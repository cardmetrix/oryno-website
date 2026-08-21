"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
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
import { clerkErrorMessage } from "@/lib/auth/clerk-errors";

type SecurityState = {
  twoFactorEnabled: boolean;
  biometricEnabled: boolean;
  hasPin: boolean;
};

type TotpResource = {
  secret?: string;
  uri?: string;
};

export default function SecurityPage() {
  const { user } = useUser();
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPinForm, setShowPinForm] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const totpOn = Boolean(user?.totpEnabled || security?.twoFactorEnabled);

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
    if (
      !window.confirm(
        "Turn off Google Authenticator? It will no longer be required at sign-in.",
      )
    ) {
      return;
    }
    void disableTotp();
  }

  async function disableTotp() {
    if (!user) return;
    setSaving(true);
    try {
      await user.disableTOTP();
      await patch({ twoFactorEnabled: false });
      await user.reload();
      toast.success("2FA disabled");
    } catch (err) {
      toast.error(
        clerkErrorMessage(err, "Could not disable 2FA. Sign in again and retry."),
      );
    } finally {
      setSaving(false);
    }
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
  const { user } = useUser();
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
    if (!user) return;
    setLoading(true);
    try {
      const totp = (await user.createTOTP()) as TotpResource;
      setSecret(totp.secret || "");
      setUri(totp.uri || "");
      setStarted(true);
    } catch (err) {
      toast.error(clerkErrorMessage(err, "Could not start authenticator setup"));
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!user || code.length < 6) return;
    setVerifying(true);
    try {
      await user.verifyTOTP({ code: code.trim() });
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twoFactorEnabled: true }),
      }).catch(() => undefined);
      await user.reload();
      toast.success("2FA enabled", {
        description: "Google Authenticator is now required at sign-in.",
      });
      reset();
      onEnabled();
      onOpenChange(false);
    } catch (err) {
      setCode("");
      toast.error(clerkErrorMessage(err, "Invalid authenticator code"));
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Google Authenticator</DialogTitle>
          <DialogDescription>
            Scan the QR code in Google Authenticator, then enter the 6-digit
            code to finish.
          </DialogDescription>
        </DialogHeader>

        {!started ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void startEnrollment()}
            className="btn-primary inline-flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate QR code
          </button>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto rounded-2xl border border-border bg-white p-4">
              {uri ? <QRCodeSVG value={uri} size={180} /> : null}
            </div>
            {secret ? (
              <button
                type="button"
                onClick={() => void copySecret()}
                className="flex w-full items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    Can’t scan? Enter this key
                  </p>
                  <p className="mt-1 truncate font-mono text-sm font-semibold">
                    {secret}
                  </p>
                </div>
                <Copy className="h-4 w-4 text-primary" />
              </button>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                Enter the 6-digit code
              </p>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup className="w-full justify-between gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-12 w-11 rounded-[12px] border border-border"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
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
      </DialogContent>
    </Dialog>
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
