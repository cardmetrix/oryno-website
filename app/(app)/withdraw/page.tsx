"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { BankAccountSummary, WalletSummary } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

export default function WithdrawPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [banks, setBanks] = useState<BankAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("5000");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    amountFormatted: string;
    reference?: string | null;
    bankName?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wallet", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as {
          primary: WalletSummary;
          banks: BankAccountSummary[];
        };
        if (cancelled) return;
        setWallet(json.primary);
        setBanks(json.banks);
        const primary =
          json.banks.find((b) => b.isPrimary) ?? json.banks[0];
        if (primary) setBankAccountId(primary.id);
      } catch {
        if (!cancelled) {
          setWallet(null);
          setBanks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onWithdraw() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, bankAccountId }),
      });
      const json = (await res.json()) as {
        error?: string;
        amountFormatted?: string;
        reference?: string | null;
        wallet?: WalletSummary;
        bank?: { bankName: string };
      };
      if (!res.ok) throw new Error(json.error || "Withdrawal failed");
      if (json.wallet) setWallet(json.wallet);
      setSuccess({
        amountFormatted: json.amountFormatted ?? amount,
        reference: json.reference,
        bankName: json.bank?.bankName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed");
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
        title="Withdraw"
        subtitle="Send funds to your local bank"
        backHref="/wallet"
      />

      {loading ? (
        <div className="space-y-4">
          <MotionSection className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="mt-3 h-12 w-full rounded-[14px]" />
            <Skeleton className="mt-4 h-4 w-32 rounded-full" />
            <Skeleton className="mt-3 h-24 w-full rounded-[16px]" />
          </MotionSection>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[28px] border border-border bg-background px-6 py-12 text-center shadow-[var(--shadow-soft)]"
            >
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <p className="mt-4 text-xl font-bold text-foreground">
                Withdrawal sent
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {success.amountFormatted}
                {success.bankName ? ` → ${success.bankName}` : ""}
              </p>
              {success.reference ? (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  Ref · {success.reference}
                </p>
              ) : null}
              {wallet ? (
                <p className="mt-4 text-sm font-semibold text-foreground">
                  Remaining · {wallet.balanceFormatted}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => router.push("/wallet")}
                className="btn-primary mt-6 h-12 w-full text-sm sm:mx-auto sm:max-w-xs"
              >
                Back to wallet
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {wallet ? (
                <MotionSection className="mb-4 rounded-[18px] border border-border bg-muted/40 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Available</span>
                  <span className="ml-2 font-bold text-foreground">
                    {wallet.balanceFormatted}
                  </span>
                </MotionSection>
              ) : null}

              <MotionSection className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">
                    Amount ({symbol})
                  </span>
                  <input
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value.replace(/[^\d]/g, ""))
                    }
                    className="mt-2 h-12 w-full rounded-[14px] border border-border bg-muted/40 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Bank Account
                    </span>
                    <Link
                      href="/wallet"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Manage
                    </Link>
                  </div>

                  {banks.length === 0 ? (
                    <div className="rounded-[16px] border border-dashed border-border px-4 py-8 text-center">
                      <p className="text-sm font-semibold text-foreground">
                        No bank account saved
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Add a payout account before withdrawing.
                      </p>
                      <Link
                        href="/wallet"
                        className="btn-primary mt-4 inline-flex h-10 items-center px-4 text-sm"
                      >
                        Add bank
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {banks.map((bank) => {
                        const selected = bankAccountId === bank.id;
                        return (
                          <button
                            key={bank.id}
                            type="button"
                            onClick={() => setBankAccountId(bank.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-left transition",
                              selected
                                ? "border-primary bg-oryno-orange-muted/50"
                                : "border-border hover:bg-muted/40",
                            )}
                          >
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                              <Building2 className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {bank.bankName}
                                {bank.isPrimary ? " · Primary" : ""}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {bank.accountName} · {bank.maskedNumber}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "h-4 w-4 rounded-full border-2",
                                selected
                                  ? "border-primary bg-primary"
                                  : "border-border",
                              )}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </MotionSection>

              {error ? (
                <p className="mt-4 text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}

              <MotionSection delay={0.08}>
                <button
                  type="button"
                  disabled={
                    submitting ||
                    !bankAccountId ||
                    Number(amount) <= 0 ||
                    banks.length === 0
                  }
                  onClick={() => void onWithdraw()}
                  className="btn-primary mt-6 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50 md:max-w-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Withdraw Funds"
                  )}
                </button>
              </MotionSection>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </AppShell>
  );
}
