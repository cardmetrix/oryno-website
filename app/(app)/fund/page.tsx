"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Hash,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { WalletSummary } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

const presets = ["1000", "2000", "5000", "10000", "20000"];

const methods = [
  {
    id: "transfer",
    title: "Bank Transfer",
    description: "Instant automated bank transfer.",
    icon: Building2,
  },
  {
    id: "card",
    title: "Debit Card",
    description: "Visa, Mastercard, Verve",
    icon: CreditCard,
  },
  {
    id: "ussd",
    title: "USSD Code",
    description: "Direct dial checkout codes.",
    icon: Hash,
  },
];

export default function FundPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("5000");
  const [method, setMethod] = useState("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    amountFormatted: string;
    reference?: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wallet", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as { primary: WalletSummary };
        if (!cancelled) setWallet(json.primary);
      } catch {
        if (!cancelled) setWallet(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onFund() {
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
        subtitle="Add money instantly with card, transfer, or USSD"
        backHref="/wallet"
      />

      {loading ? (
        <div className="space-y-4">
          <MotionSection className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="mt-3 h-16 w-full rounded-[16px]" />
            <div className="mt-4 flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-20 rounded-full" />
              ))}
            </div>
          </MotionSection>
          <MotionSection
            delay={0.05}
            className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <Skeleton className="h-4 w-36 rounded-full" />
            <div className="mt-3 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-[16px]" />
              ))}
            </div>
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

                <MotionSection className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
                  <label className="block">
                    <span className="text-sm font-medium text-foreground">
                      Enter Amount
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
                  delay={0.08}
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

                <MotionSection delay={0.12}>
                  <button
                    type="button"
                    disabled={submitting || Number(amount) <= 0}
                    onClick={() => void onFund()}
                    className="btn-primary mt-6 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50 md:max-w-sm"
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
                </MotionSection>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AppShell>
  );
}
