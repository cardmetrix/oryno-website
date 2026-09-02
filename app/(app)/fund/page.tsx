"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Copy, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { Skeleton } from "@/components/ui/skeleton";
import type { WalletSummary } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

type DepositAccount = {
  id: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankSlug: string | null;
  currency: string;
  provider: string;
  status: string;
  demoMode: boolean;
  instructions: string;
};

type IdentityRequired = {
  required: true;
  idTypes: Array<"BVN" | "NIN">;
  message: string;
  kycStatus: string;
  kycLevel: number;
  hasPendingKyc: boolean;
};

export default function FundPage() {
  return (
    <Suspense
      fallback={
        <AppShell hideNav>
          <PageHeader
            title="Fund Wallet"
            subtitle="Transfer to your dedicated account"
            backHref="/wallet"
          />
        </AppShell>
      }
    >
      <FundPageContent />
    </Suspense>
  );
}

function FundPageContent() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [deposit, setDeposit] = useState<DepositAccount | null>(null);
  const [identityRequired, setIdentityRequired] =
    useState<IdentityRequired | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [submittingIdentity, setSubmittingIdentity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [copied, setCopied] = useState<"number" | "name" | null>(null);
  const [idType, setIdType] = useState<"BVN" | "NIN">("BVN");
  const [idNumber, setIdNumber] = useState("");
  const lastBalanceRef = useRef<string | null>(null);
  const redirectedRef = useRef(false);

  const goToLatestFundReceipt = useCallback(async () => {
    if (redirectedRef.current) return;
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        recent?: Array<{ id: string; type: string; category?: string }>;
      };
      const latest =
        json.recent?.find(
          (tx) =>
            tx.type === "credit" &&
            (!tx.category || tx.category === "fund"),
        ) ?? json.recent?.find((tx) => tx.type === "credit");
      if (latest?.id) {
        redirectedRef.current = true;
        router.replace(`/history/${latest.id}`);
      }
    } catch {
      // keep user on fund page if receipt lookup fails
    }
  }, [router]);

  const refreshWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { primary: WalletSummary };
      const next = json.primary;
      const prev = lastBalanceRef.current;

      if (
        prev != null &&
        next.balance !== prev &&
        Number(next.balance) > Number(prev)
      ) {
        toast.success("Payment received", {
          description: `Your wallet is now ${next.balanceFormatted}`,
        });
        void goToLatestFundReceipt();
      }

      lastBalanceRef.current = next.balance;
      setWallet(next);
    } catch {
      // keep existing balance on soft poll failures
    }
  }, [goToLatestFundReceipt]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupHint(null);
    try {
      const [walletRes, depositRes] = await Promise.all([
        fetch("/api/wallet", { cache: "no-store" }),
        fetch("/api/wallet/deposit-account", { cache: "no-store" }),
      ]);

      if (walletRes.ok) {
        const json = (await walletRes.json()) as { primary: WalletSummary };
        lastBalanceRef.current = json.primary.balance;
        setWallet(json.primary);
      }

      const json = (await depositRes.json().catch(() => ({}))) as {
        account?: DepositAccount | null;
        identityRequired?: IdentityRequired | null;
        error?: string;
        setupHint?: string | null;
      };

      if (depositRes.ok) {
        setDeposit(json.account ?? null);
        setIdentityRequired(json.identityRequired ?? null);
        setSetupHint(json.setupHint ?? null);
        if (!json.account && !json.identityRequired) {
          setError(json.error || "Could not load your dedicated account. Try refresh.");
        }
      } else {
        setDeposit(json.account ?? null);
        setIdentityRequired(json.identityRequired ?? null);
        setSetupHint(json.setupHint ?? null);
        setError(json.error || "Could not load your dedicated account");
      }
    } catch {
      setError("Could not load your dedicated account");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshWallet();
    }, 8000);
    return () => window.clearInterval(id);
  }, [refreshWallet]);

  async function copyText(value: string, kind: "number" | "name") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(
        kind === "number" ? "Account number copied" : "Account name copied",
      );
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function onIHaveFunded() {
    setChecking(true);
    setError(null);
    toast.message("Checking for your transfer", {
      description:
        "We’re matching your bank payment with Flutterwave. This can take a few minutes.",
    });
    try {
      const res = await fetch("/api/wallet/deposit-account/reconcile", {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        credited?: number;
        message?: string;
        error?: string;
        wallet?: { balanceFormatted?: string };
      };

      if (res.ok) {
        if ((json.credited ?? 0) > 0) {
          toast.success(json.message || "Deposit received");
        } else {
          toast.message(json.message || "No new deposit yet", {
            description: "If you just transferred, wait a few minutes and try again.",
          });
        }
      } else if (json.error) {
        setError(json.error);
        toast.error(json.error);
      }
    } catch {
      toast.error("Could not check for your deposit");
    }
    await refreshWallet();
    setChecking(false);
  }

  async function onSubmitIdentity(event: React.FormEvent) {
    event.preventDefault();
    const digits = idNumber.replace(/\D/g, "");
    if (digits.length !== 11) {
      setError(`${idType} must be exactly 11 digits.`);
      return;
    }

    setSubmittingIdentity(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/deposit-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idType, idNumber: digits }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        account?: DepositAccount | null;
        identityRequired?: IdentityRequired | null;
        error?: string;
      };

      if (json.account) {
        setDeposit(json.account);
        setIdentityRequired(null);
        setIdNumber("");
        toast.success("Your fund account is ready");
        return;
      }

      setIdentityRequired(json.identityRequired ?? null);
      setError(json.error || "Could not create your fund account. Try again.");
    } catch {
      setError("Could not save your details. Try again.");
    } finally {
      setSubmittingIdentity(false);
    }
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Fund Wallet"
        subtitle="Transfer to your dedicated account"
        backHref="/wallet"
      />

      {loading ? (
        <div className="space-y-4">
          <MotionSection className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="mt-3 h-16 w-full rounded-[16px]" />
          </MotionSection>
          <MotionSection
            delay={0.05}
            className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <Skeleton className="h-40 w-full rounded-[16px]" />
          </MotionSection>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {wallet ? (
            <MotionSection className="mb-4 rounded-[18px] border border-border bg-muted/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Current balance</span>
              <span className="ml-2 font-bold text-foreground">
                {wallet.balanceFormatted}
              </span>
            </MotionSection>
          ) : null}

          {identityRequired ? (
            <MotionSection
              delay={0.04}
              className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Verify to get your account number
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {identityRequired.message}
                  </p>
                </div>
              </div>

              <form onSubmit={(event) => void onSubmitIdentity(event)}>
                <div className="mb-4 flex gap-2">
                  {identityRequired.idTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setIdType(type);
                        setError(null);
                      }}
                      className={cn(
                        "flex-1 rounded-full px-3 py-2 text-sm font-semibold transition-colors",
                        idType === type
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <AuthField
                  label={idType === "BVN" ? "Bank Verification Number" : "National ID Number"}
                >
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={11}
                    value={idNumber}
                    onChange={(event) => {
                      setIdNumber(event.target.value.replace(/\D/g, ""));
                      setError(null);
                    }}
                    placeholder={`11-digit ${idType}`}
                    className={authInputClassName}
                  />
                </AuthField>

                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  We use your {idType} only to create your personal fund account.
                  It must match your name on ORYNO.
                </p>

                <button
                  type="submit"
                  disabled={submittingIdentity || idNumber.length !== 11}
                  className="btn-primary mt-5 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50"
                >
                  {submittingIdentity ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    "Get my account number"
                  )}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Already started verification?{" "}
                <Link
                  href="/settings/kyc"
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  View KYC status
                </Link>
              </p>
            </MotionSection>
          ) : (
            <MotionSection
              delay={0.04}
              className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Bank details
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    void load();
                    void refreshWallet();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>

              {deposit ? (
                <div className="space-y-3 rounded-[18px] bg-muted/40 p-4">
                  <DetailRow label="Bank" value={deposit.bankName} />
                  <DetailRow
                    label="Account name"
                    value={deposit.accountName}
                    onCopy={() => void copyText(deposit.accountName, "name")}
                    copied={copied === "name"}
                  />
                  <DetailRow
                    label="Account number"
                    value={deposit.accountNumber}
                    mono
                    emphasize
                    onCopy={() =>
                      void copyText(deposit.accountNumber, "number")
                    }
                    copied={copied === "number"}
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {deposit.instructions}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Deposit account unavailable. Try refresh.
                </p>
              )}
            </MotionSection>
          )}

          {deposit ? (
            <MotionSection delay={0.12} className="mt-5 md:max-w-sm">
              <button
                type="button"
                disabled={checking}
                onClick={() => void onIHaveFunded()}
                className="btn-primary inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50"
              >
                {checking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking…
                  </>
                ) : (
                  "I’ve funded — check balance"
                )}
              </button>
            </MotionSection>
          ) : null}

          {error ? (
            <p className="mt-4 text-sm font-medium text-destructive">{error}</p>
          ) : null}
          {setupHint ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {setupHint}
            </p>
          ) : null}
        </motion.div>
      )}
    </AppShell>
  );
}

function DetailRow({
  label,
  value,
  mono,
  emphasize,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasize?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 break-all text-sm font-semibold text-foreground",
            mono && "font-mono tracking-wide",
            emphasize && "text-base",
          )}
        >
          {value}
        </p>
      </div>
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-background px-3 text-xs font-semibold text-foreground ring-1 ring-border"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      ) : null}
    </div>
  );
}
