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
import {
  TransactionPinModal,
  type TransactionPinModalMode,
} from "@/components/app/transaction-pin-modal";
import { Skeleton } from "@/components/ui/skeleton";
import type { BankAccountSummary, WalletSummary } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

const WITHDRAW_INSTRUCTIONS = [
  "Add and verify a payout bank on Wallet if you haven’t already.",
  "Enter the amount you want to withdraw from your ORYNO wallet.",
  "Select the bank account Paystack should pay into.",
  "Confirm with your transaction PIN. We debit your wallet and send the transfer via Paystack.",
  "When Paystack confirms delivery, the withdrawal is marked complete.",
];

export default function WithdrawPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [banks, setBanks] = useState<BankAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinMode, setPinMode] = useState<TransactionPinModalMode>("confirm");
  const [pinError, setPinError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    amountFormatted: string;
    reference?: string | null;
    bankName?: string;
    pending?: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [walletRes, settingsRes] = await Promise.all([
          fetch("/api/wallet", { cache: "no-store" }),
          fetch("/api/settings", { cache: "no-store" }),
        ]);
        if (!walletRes.ok) throw new Error("Failed");
        const json = (await walletRes.json()) as {
          primary: WalletSummary;
          banks: BankAccountSummary[];
        };
        if (cancelled) return;
        setWallet(json.primary);
        setBanks(json.banks);
        const primary =
          json.banks.find((b) => b.isPrimary) ?? json.banks[0];
        if (primary) setBankAccountId(primary.id);
        const currency = json.primary.currency;
        setAmount((prev) => {
          if (prev) return prev;
          if (currency === "GHS") return "50";
          if (currency === "KES") return "500";
          if (currency === "ZAR") return "100";
          return "5000";
        });

        if (settingsRes.ok) {
          const settings = (await settingsRes.json()) as {
            security?: { hasPin?: boolean };
          };
          setHasPin(Boolean(settings.security?.hasPin));
        }
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

  function openPinModal() {
    setError(null);
    setPinError(null);
    setPinMode(hasPin ? "confirm" : "create");
    setPinModalOpen(true);
  }

  async function submitWithdraw(payload: {
    pin: string;
    isCreate: boolean;
  }) {
    setSubmitting(true);
    setError(null);
    setPinError(null);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          bankAccountId,
          pin: payload.pin,
          ...(payload.isCreate ? { newPin: payload.pin } : {}),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        code?: string;
        hasPin?: boolean;
        amountFormatted?: string;
        reference?: string | null;
        pending?: boolean;
        transactionId?: string;
        wallet?: WalletSummary;
        bank?: { bankName: string };
      };
      if (!res.ok) {
        if (json.code?.startsWith("pin_") || json.hasPin === false) {
          if (typeof json.hasPin === "boolean") setHasPin(json.hasPin);
          setPinError(json.error || "PIN verification failed");
          return;
        }
        throw new Error(json.error || "Withdrawal failed");
      }

      if (payload.isCreate) setHasPin(true);
      setPinModalOpen(false);
      if (json.wallet) setWallet(json.wallet);

      if (json.transactionId) {
        router.replace(`/history/${json.transactionId}`);
        return;
      }

      setSuccess({
        amountFormatted: json.amountFormatted ?? amount,
        reference: json.reference,
        bankName: json.bank?.bankName,
        pending: Boolean(json.pending),
      });
    } catch (err) {
      setPinModalOpen(false);
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
        subtitle="Send funds to your bank or mobile money via Paystack"
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
                {success.pending ? "Withdrawal processing" : "Withdrawal sent"}
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
              {success.pending ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Paystack is delivering this transfer. You’ll get a
                  notification when it lands.
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
                      setAmount(e.target.value.replace(/[^\d.]/g, ""))
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
                        Add a Paystack-verified payout account before
                        withdrawing.
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
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
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
                    banks.length === 0 ||
                    (wallet != null && Number(amount) > Number(wallet.balance) + 0.0001)
                  }
                  onClick={openPinModal}
                  className="btn-primary mt-6 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50 md:max-w-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : wallet != null &&
                    Number(amount) > Number(wallet.balance) + 0.0001 ? (
                    "Insufficient balance"
                  ) : (
                    "Withdraw Funds"
                  )}
                </button>
              </MotionSection>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <TransactionPinModal
        open={pinModalOpen}
        mode={pinMode}
        loading={submitting}
        error={pinError}
        confirmLabel={
          pinMode === "create" ? "Set PIN & withdraw" : "Confirm withdrawal"
        }
        onOpenChange={(open) => {
          if (!submitting) {
            setPinModalOpen(open);
            if (!open) setPinError(null);
          }
        }}
        onConfirm={(payload) => void submitWithdraw(payload)}
      />
    </AppShell>
  );
}
