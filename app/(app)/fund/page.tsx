"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Hash,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
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

const presets = ["1000", "2000", "5000", "10000", "20000"];

const methods = [
  {
    id: "transfer",
    title: "Bank Transfer",
    description: "Deposit to your personal ORYNO account number.",
    icon: Building2,
  },
  {
    id: "card",
    title: "Debit Card",
    description: "Visa, Mastercard, Verve (demo instant credit)",
    icon: CreditCard,
  },
  {
    id: "ussd",
    title: "USSD Code",
    description: "Direct dial checkout codes (demo)",
    icon: Hash,
  },
];

export default function FundPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [deposit, setDeposit] = useState<DepositAccount | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("5000");
  const [method, setMethod] = useState("transfer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"number" | "name" | null>(null);
  const [success, setSuccess] = useState<{
    amountFormatted: string;
    reference?: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [walletRes, depositRes] = await Promise.all([
        fetch("/api/wallet", { cache: "no-store" }),
        fetch("/api/wallet/deposit-account", { cache: "no-store" }),
      ]);

      if (walletRes.ok) {
        const json = (await walletRes.json()) as { primary: WalletSummary };
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

  async function copyText(value: string, kind: "number" | "name") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(kind === "number" ? "Account number copied" : "Account name copied");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function onInstantFund() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method }),
      });
      const json = (await res.json()) as {
        error?: string;
        amountFormatted?: string;
        reference?: string | null;
        wallet?: WalletSummary;
      };
      if (!res.ok) throw new Error(json.error || "Funding failed");
      if (json.wallet) setWallet(json.wallet);
      setSuccess({
        amountFormatted: json.amountFormatted ?? amount,
        reference: json.reference,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Funding failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSimulateDeposit() {
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
        reference?: string | null;
        wallet?: WalletSummary;
      };
      if (!res.ok) throw new Error(json.error || "Demo deposit failed");
      if (json.wallet) setWallet(json.wallet);
      setSuccess({
        amountFormatted: json.amountFormatted ?? `${amount}`,
        reference: json.reference,
      });
      toast.success("Demo deposit credited");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo deposit failed");
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
        <>
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="rounded-[28px] border border-border bg-background px-6 py-12 text-center shadow-[var(--shadow-soft)]"
              >
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <p className="mt-4 text-xl font-bold text-foreground">
                  Wallet funded
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {success.amountFormatted} added to your balance
                </p>
                {success.reference ? (
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    Ref · {success.reference}
                  </p>
                ) : null}
                {wallet ? (
                  <p className="mt-4 text-sm font-semibold text-foreground">
                    New balance · {wallet.balanceFormatted}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-col gap-2 sm:mx-auto sm:max-w-xs">
                  <button
                    type="button"
                    onClick={() => router.push("/wallet")}
                    className="btn-primary h-12 w-full text-sm"
                  >
                    Back to wallet
                  </button>
                  <button
                    type="button"
                    onClick={() => setSuccess(null)}
                    className="btn-secondary h-11 w-full text-sm"
                  >
                    Fund again
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
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

                {demoMode ? (
                  <MotionSection className="mb-4 rounded-[18px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
                    Paystack <strong>test/demo mode</strong> — use “Simulate
                    deposit” to credit your wallet without a real bank transfer.
                  </MotionSection>
                ) : null}

                <MotionSection
                  delay={0.04}
                  className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      Your deposit account
                    </h2>
                    <button
                      type="button"
                      onClick={() => void load()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh
                    </button>
                  </div>

                  {deposit ? (
                    <div className="space-y-3 rounded-[18px] bg-muted/40 p-4">
                      <DetailRow
                        label="Bank"
                        value={deposit.bankName}
                      />
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
                      <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                        {deposit.instructions}
                      </p>
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
                  <label className="block">
                    <span className="text-sm font-medium text-foreground">
                      Amount {method === "transfer" ? "(for simulate / display)" : ""}
                    </span>
                    <div className="mt-2 flex h-16 items-center rounded-[16px] border-2 border-primary bg-muted/30 px-4">
                      <span className="mr-2 text-xl font-semibold text-muted-foreground">
                        {symbol}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={Number(amount || 0).toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, "");
                          setAmount(raw || "0");
                        }}
                        className="w-full bg-transparent text-2xl font-bold text-foreground outline-none"
                      />
                    </div>
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset)}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                          amount === preset
                            ? "bg-primary text-white shadow-[var(--shadow-orange)]"
                            : "bg-muted text-foreground hover:bg-muted/80",
                        )}
                      >
                        {symbol}
                        {Number(preset).toLocaleString()}
                      </button>
                    ))}
                  </div>
                </MotionSection>

                <MotionSection
                  delay={0.1}
                  className="mt-5 rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
                >
                  <h2 className="mb-3 text-base font-semibold text-foreground">
                    Payment Method
                  </h2>
                  <div className="space-y-3">
                    {methods.map((item) => {
                      const Icon = item.icon;
                      const selected = method === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setMethod(item.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-[16px] border px-4 py-3.5 text-left transition-colors",
                            selected
                              ? "border-primary bg-oryno-orange-muted/50"
                              : "border-border bg-background hover:bg-muted/50",
                          )}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
                            <Icon className="h-5 w-5" strokeWidth={1.75} />
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">
                              {item.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border-2",
                              selected ? "border-primary" : "border-border",
                            )}
                          >
                            {selected ? (
                              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </MotionSection>

                {error ? (
                  <p className="mt-4 text-sm font-medium text-destructive">
                    {error}
                  </p>
                ) : null}

                <MotionSection delay={0.12} className="mt-6 space-y-3 md:max-w-sm">
                  {method === "transfer" ? (
                    <>
                      {demoMode ? (
                        <button
                          type="button"
                          disabled={submitting || Number(amount) <= 0}
                          onClick={() => void onSimulateDeposit()}
                          className="btn-primary inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Crediting…
                            </>
                          ) : (
                            "Simulate deposit (demo)"
                          )}
                        </button>
                      ) : (
                        <p className="rounded-[16px] bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                          Transfer to the account above from your bank app.
                          Your wallet updates automatically when Paystack
                          confirms the payment.
                        </p>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting || Number(amount) <= 0}
                      onClick={() => void onInstantFund()}
                      className="btn-primary inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing…
                        </>
                      ) : (
                        "Fund Wallet Now"
                      )}
                    </button>
                  )}
                </MotionSection>
              </motion.div>
            )}
          </AnimatePresence>
        </>
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
