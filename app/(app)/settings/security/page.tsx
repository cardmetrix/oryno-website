"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Fingerprint, KeyRound, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
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
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

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
      toast.success("Security updated");
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
      setShowPinForm(false);
      setCurrentPin("");
      setPin("");
      setConfirmPin("");
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Security Settings"
        subtitle="2FA, biometrics, and transaction PIN"
        backHref="/settings"
      />

      {loading || !security ? (
        <MotionSection className="space-y-3 rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[14px]" />
          ))}
        </MotionSection>
      ) : (
        <>
          <MotionSection className="space-y-3 rounded-[28px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]">
            <SecurityRow
              icon={Shield}
              title="Two-Factor Auth (2FA)"
              subtitle="Extra login protection"
              checked={security.twoFactorEnabled}
              disabled={saving}
              onCheckedChange={(v) => void patch({ twoFactorEnabled: v })}
            />
            <SecurityRow
              icon={Fingerprint}
              title="Biometric Sign In"
              subtitle="Face ID / fingerprint on device"
              checked={security.biometricEnabled}
              disabled={saving}
              onCheckedChange={(v) => void patch({ biometricEnabled: v })}
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
                {security.hasPin ? "Change transaction PIN" : "Create transaction PIN"}
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
    </AppShell>
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
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
