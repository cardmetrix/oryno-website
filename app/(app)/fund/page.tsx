"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { WalletSummary } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

const DEMO_AMOUNTS = ["1000", "2000", "5000", "10000"];

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

const FUND_INSTRUCTIONS = [
  "Copy the account number above (or the account name if needed).",
  "Open your bank or fintech app and start a transfer to that account.",
  "Enter any amount you want to add to your ORYNO wallet.",
  "Confirm the transfer. Use the exact bank and account name shown.",
  "When Paystack confirms the payment, your wallet balance updates automatically.",
];

export default function FundPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [deposit, setDeposit] = useState<DepositAccount | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"number" | "name" | null>(null);
  const [demoAmount, setDemoAmount] = useState("5000");
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

  const refreshWallet = useCallback(async (opts?: { silent?: boolean }) => {
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
      if (!opts?.silent) {
        // keep existing balance on soft poll failures
      }
    }
  }, [goToLatestFundReceipt]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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

      if (depositRes.ok) {
        const json = (await depositRes.json()) as {
          account: DepositAccount;
          demoMode?: boolean;
        };
        setDeposit(json.account);
        setDemoMode(Boolean(json.demoMode ?? json.account.demoMode));
      } else {
        const json = (await depositRes.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(json.error || "Could not load deposit account");
      }
    } catch {
      setError("Could not load funding details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll balance while user is on Fund — Paystack webhook credits in the background
  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshWallet({ silent: true });
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
    if (!demoMode) {
      toast.message("Waiting for Paystack", {
        description:
          "Transfer to the account above. Your balance updates when payment is confirmed.",
      });
      void refreshWallet({ silent: true });
      return;
    }

    const amount = Number(demoAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid demo amount");
      return;
    }


    
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/fund/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = (await res.json()) as {
        error?: string;
        amountFormatted?: string;
        wallet?: WalletSummary;
        reference?: string;
        transactionId?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not process demo funding");

      if (json.wallet) {
        lastBalanceRef.current = json.wallet.balance;
        setWallet(json.wallet);
      } else {
        await refreshWallet({ silent: true });
      }

      if (json.transactionId) {
        redirectedRef.current = true;
        router.replace(`/history/${json.transactionId}`);
        return;
      }

      toast.success("Demo funding successful", {
        description: `${json.amountFormatted ?? `₦${amount.toLocaleString()}`} added to your wallet`,
      });
      await goToLatestFundReceipt();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not process demo funding";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const symbol =
    wallet?.currency === "GHS"
      ? "GH₵"
      : wallet?.currency === "KES"
        ? "KSh"
        : wallet?.currency === "ZAR"
          ? "R"
          : "₦";

  return (
    <AppShell hideNav>
      <PageHeader
        title="Fund Wallet"
        subtitle="Transfer to your personal ORYNO account number"
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
                  void refreshWallet({ silent: true });
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
                  onCopy={() => void copyText(deposit.accountNumber, "number")}
                  copied={copied === "number"}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Deposit account unavailable. Try refresh.
              </p>
            )}
          </MotionSection>

          <MotionSection
            delay={0.08}
            className="mt-5 rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <h2 className="text-base font-semibold text-foreground">
              Instructions
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Follow these steps to fund your ORYNO wallet
            </p>
            <ol className="mt-4 space-y-3">
              {FUND_INSTRUCTIONS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-oryno-orange-muted text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-relaxed text-foreground">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </MotionSection>

          {demoMode ? (
            <MotionSection
              delay={0.12}
              className="mt-5 rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <h2 className="text-base font-semibold text-foreground">
                I have funded
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Demo only — confirms a Paystack-style deposit and credits your
                wallet now.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {DEMO_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDemoAmount(preset)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                      demoAmount === preset
                        ? "bg-oryno-charcoal text-white"
                        : "bg-muted text-muted-foreground hover:bg-oryno-orange-muted hover:text-primary",
                    )}
                  >
                    {symbol}
                    {Number(preset).toLocaleString()}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={submitting || !deposit}
                onClick={() => void onIHaveFunded()}
                className="btn-primary mt-4 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50 md:max-w-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  "I’ve funded"
                )}
              </button>
            </MotionSection>
          ) : (
            <MotionSection delay={0.12} className="mt-5 md:max-w-sm">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onIHaveFunded()}
                className="btn-primary inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50"
              >
                I’ve funded — check balance
              </button>
            </MotionSection>
          )}

          {error ? (
            <p className="mt-4 text-sm font-medium text-destructive">{error}</p>
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
