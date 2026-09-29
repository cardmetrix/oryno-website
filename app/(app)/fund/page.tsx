"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import type { WalletSummary } from "@/lib/wallet-types";
import { publicPaymentError } from "@/lib/flutterwave/errors";
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

type FundOptions = {
  method?: "dva" | "checkout";
  checkoutAvailable?: boolean;
  dvaAvailable?: boolean;
  countryCode?: string;
  currency?: string;
  presets?: string[];
  paymentOptions?: string;
  account?: DepositAccount | null;
  identityRequired?: IdentityRequired | null;
  error?: string;
  setupHint?: string | null;
  demoMode?: boolean;
};

const PAYMENT_OPTION_LABELS: Record<string, string> = {
  card: "Card",
  banktransfer: "Bank transfer",
  ussd: "USSD",
  account: "Account",
  mobilemoneyghana: "Mobile money",
  mpesa: "M-Pesa",
  mobilemoneyeastafrica: "Mobile money",
};

function formatPaymentOptions(raw?: string | null) {
  if (!raw) return "Card";
  return raw
    .split(",")
    .map((p) => PAYMENT_OPTION_LABELS[p.trim()] ?? p.trim())
    .filter(Boolean)
    .join(" · ");
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function FundPage() {
  return (
    <Suspense
      fallback={
        <AppShell hideNav>
          <PageHeader
            title="Fund Wallet"
            subtitle="Add money to your local wallet"
            backHref="/dashboard"
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
  const searchParams = useSearchParams();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [deposit, setDeposit] = useState<DepositAccount | null>(null);
  const [identityRequired, setIdentityRequired] =
    useState<IdentityRequired | null>(null);
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);
  const [currency, setCurrency] = useState("NGN");
  const [countryCode, setCountryCode] = useState("NG");
  const [presets, setPresets] = useState<string[]>([
    "1000",
    "2000",
    "5000",
    "10000",
  ]);
  const [paymentOptions, setPaymentOptions] = useState("card");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [preferCheckout, setPreferCheckout] = useState(false);
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
  const verifiedRef = useRef(false);
  const { data: walletPayload, refetch: refetchWallet } = useWallet({
    refetchInterval: 8000,
  });

  const goToLatestFundReceipt = useCallback(async () => {
    if (redirectedRef.current) return;
    try {
      const { data: json } = await refetchWallet();
      const latest =
        json?.recent?.find(
          (tx) =>
            tx.type === "credit" &&
            (!tx.category || tx.category === "fund"),
        ) ?? json?.recent?.find((tx) => tx.type === "credit");
      if (latest?.id) {
        redirectedRef.current = true;
        router.replace(`/history/${latest.id}`);
      }
    } catch {
      // keep user on fund page if receipt lookup fails
    }
  }, [refetchWallet, router]);

  useEffect(() => {
    if (!walletPayload?.primary) return;
    const next = walletPayload.primary;
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
    setCurrency(next.currency);
  }, [walletPayload, goToLatestFundReceipt]);

  const applyOptions = useCallback((json: FundOptions) => {
    setDeposit(json.account ?? null);
    setIdentityRequired(json.identityRequired ?? null);
    const hint = json.setupHint?.trim() || null;
    setSetupHint(
      hint && publicPaymentError(hint) === "Service unavailable" ? null : hint,
    );
    setCheckoutAvailable(Boolean(json.checkoutAvailable));
    if (json.currency) setCurrency(json.currency);
    if (json.countryCode) setCountryCode(json.countryCode);
    if (json.presets?.length) {
      setPresets(json.presets);
      setAmount((prev) => prev || json.presets![0]);
    }
    if (json.paymentOptions) setPaymentOptions(json.paymentOptions);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupHint(null);
    try {
      const depositRes = await fetch("/api/wallet/deposit-account", {
        cache: "no-store",
      });

      const json = (await depositRes.json().catch(() => ({}))) as FundOptions;

      applyOptions(json);

      const hasPath =
        Boolean(json.account) ||
        Boolean(json.identityRequired) ||
        Boolean(json.checkoutAvailable);

      if (!depositRes.ok && !hasPath) {
        setError(
          publicPaymentError(json.error || "Could not load funding options"),
        );
      } else if (!hasPath && json.error) {
        setError(publicPaymentError(json.error));
      }
    } catch {
      setError("Could not load funding options");
    } finally {
      setLoading(false);
    }
  }, [applyOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  // Flutterwave checkout return: /fund?local_fund=1&tx_ref=...
  useEffect(() => {
    const localFund = searchParams.get("local_fund");
    const reference =
      searchParams.get("tx_ref") ||
      searchParams.get("reference") ||
      searchParams.get("trxref");
    const transactionId =
      searchParams.get("transaction_id") || searchParams.get("transactionId");
    if (!localFund || (!reference && !transactionId) || verifiedRef.current) {
      return;
    }
    verifiedRef.current = true;

    let cancelled = false;
    (async () => {
      setVerifying(true);
      setError(null);
      try {
        const res = await fetch("/api/wallet/fund/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, transactionId }),
        });
        const json = (await res.json()) as {
          error?: string;
          transactionId?: string;
          amountFormatted?: string;
        };
        if (!res.ok) throw new Error(json.error || "Could not verify payment");
        if (cancelled) return;
        toast.success("Wallet funded successfully", {
          description: json.amountFormatted,
        });
        await refetchWallet();
        redirectedRef.current = true;
        router.replace(
          json.transactionId
            ? `/history/${json.transactionId}`
            : "/dashboard",
        );
      } catch (err) {
        if (cancelled) return;
        const message = publicPaymentError(
          err instanceof Error ? err.message : "Payment verification failed",
        );
        setError(message);
        toast.error(message);
        router.replace("/fund");
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, refetchWallet, router]);

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
        "We’re matching your bank payment. This can take a few minutes.",
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
            description:
              "If you just transferred, wait a few minutes and try again.",
          });
        }
      } else if (json.error) {
        const message = publicPaymentError(json.error);
        setError(message);
        toast.error(message);
      }
    } catch {
      toast.error("Could not check for your deposit");
    }
    await refetchWallet();
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
      const json = (await res.json().catch(() => ({}))) as FundOptions;

      applyOptions(json);

      if (json.account) {
        setIdNumber("");
        toast.success("Your fund account is ready");
        return;
      }

      setError(
        publicPaymentError(
          json.error || "Could not create your fund account. Try again.",
        ),
      );
    } catch {
      setError("Could not save your details. Try again.");
    } finally {
      setSubmittingIdentity(false);
    }
  }

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const currentBalance = Number(wallet?.balance ?? 0);
  const resultingBalance = amountValid ? currentBalance + amountNum : null;

  const depositDetails = useMemo(() => {
    if (!amountValid) return null;
    return {
      amount: amountNum,
      currency,
      methodLabel: formatPaymentOptions(paymentOptions),
      feeLabel: "Provider fees may apply at checkout",
      credited: amountNum,
      creditedFormatted: formatMoney(amountNum, currency),
      payFormatted: formatMoney(amountNum, currency),
      resultingFormatted:
        resultingBalance != null
          ? formatMoney(resultingBalance, currency)
          : null,
      countryCode,
    };
  }, [
    amountValid,
    amountNum,
    currency,
    paymentOptions,
    resultingBalance,
    countryCode,
  ]);

  async function onPayWithCard() {
    if (!depositDetails) return;
    setPaying(true);
    setError(null);
    try {
      const callbackUrl = `${window.location.origin}/fund?local_fund=1`;
      const res = await fetch("/api/wallet/fund/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: depositDetails.amount,
          callbackUrl,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        authorizationUrl?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not start payment");
      if (!json.authorizationUrl) {
        throw new Error("Payment page unavailable. Try again.");
      }
      window.location.href = json.authorizationUrl;
    } catch (err) {
      setError(
        publicPaymentError(
          err instanceof Error ? err.message : "Could not start payment",
        ),
      );
      setConfirming(false);
      setPaying(false);
    }
  }

  const showCheckout =
    checkoutAvailable &&
    (preferCheckout || (!deposit && !identityRequired));
  const showIdentity = Boolean(identityRequired) && !preferCheckout;
  const showDva = Boolean(deposit) && !preferCheckout && !identityRequired;

  return (
    <AppShell hideNav>
      <PageHeader
        title="Fund Wallet"
        subtitle={
          showCheckout
            ? "Deposit by card or mobile money"
            : "Transfer to your dedicated account"
        }
        backHref="/dashboard"
      />

      {verifying ? (
        <MotionSection className="mb-4 flex items-center gap-3 rounded-[18px] border border-border bg-muted/40 px-4 py-4 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Confirming your payment…</span>
        </MotionSection>
      ) : null}

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

          {showCheckout ? (
            <MotionSection
              delay={0.04}
              className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Deposit by card
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Your country doesn&apos;t offer a dedicated account number.
                    Pay with card or mobile money — your {currency} wallet is
                    credited instantly after payment.
                  </p>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">
                  Amount ({currency})
                </span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/[^\d.]/g, ""));
                    setConfirming(false);
                  }}
                  placeholder="0.00"
                  className="h-12 w-full rounded-xl border border-border bg-background px-3 text-base font-semibold outline-none focus:border-primary"
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setAmount(p);
                      setConfirming(false);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
                      amount === p
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-muted/50 text-muted-foreground ring-border",
                    )}
                  >
                    {formatMoney(Number(p), currency)}
                  </button>
                ))}
              </div>

              {depositDetails ? (
                <div className="mt-5 space-y-2.5 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
                  <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    Deposit details
                  </p>
                  <DetailPlain
                    label="You pay"
                    value={depositDetails.payFormatted}
                    emphasize
                  />
                  <DetailPlain label="Currency" value={depositDetails.currency} />
                  <DetailPlain
                    label="Payment methods"
                    value={depositDetails.methodLabel}
                  />
                  <DetailPlain label="ORYNO fee" value="Free" />
                  <DetailPlain
                    label="Provider fee"
                    value={depositDetails.feeLabel}
                  />
                  <DetailPlain
                    label="Credited to wallet"
                    value={depositDetails.creditedFormatted}
                    emphasize
                  />
                  {depositDetails.resultingFormatted ? (
                    <DetailPlain
                      label="Balance after deposit"
                      value={depositDetails.resultingFormatted}
                    />
                  ) : null}
                  <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                    You’ll complete payment securely. Funds land
                    in your local ({currency}) wallet 1:1 after confirmation.
                  </p>
                </div>
              ) : null}

              {error ? (
                <p className="mt-3 text-sm font-medium text-destructive">
                  {error}
                </p>
              ) : null}

              {!confirming ? (
                <button
                  type="button"
                  disabled={!depositDetails}
                  onClick={() => setConfirming(true)}
                  className="btn-primary mt-5 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  Review deposit
                </button>
              ) : (
                <div className="mt-5 space-y-3">
                  <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                    Confirm the deposit details above. You’ll be redirected to
                    pay with your card or mobile money.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="h-12 rounded-xl border border-border text-sm font-semibold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={paying}
                      onClick={() => void onPayWithCard()}
                      className="btn-primary inline-flex h-12 items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                      {paying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Pay now
                    </button>
                  </div>
                </div>
              )}

              {preferCheckout && (deposit || identityRequired) ? (
                <button
                  type="button"
                  onClick={() => setPreferCheckout(false)}
                  className="mt-4 w-full text-center text-sm font-semibold text-primary"
                >
                  Use bank account instead
                </button>
              ) : null}
            </MotionSection>
          ) : null}

          {showIdentity ? (
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
                    {identityRequired!.message}
                  </p>
                </div>
              </div>

              <form onSubmit={(event) => void onSubmitIdentity(event)}>
                <div className="mb-4 flex gap-2">
                  {identityRequired!.idTypes.map((type) => (
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
                  label={
                    idType === "BVN"
                      ? "Bank Verification Number"
                      : "National ID Number"
                  }
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
                  We use your {idType} only to create your personal fund
                  account. It must match your name on ORYNO.
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

              {checkoutAvailable ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreferCheckout(true);
                    setConfirming(false);
                  }}
                  className="mt-4 w-full text-center text-sm font-semibold text-primary"
                >
                  Or deposit by card instead
                </button>
              ) : (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Already started verification?{" "}
                  <Link
                    href="/settings"
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    View settings
                  </Link>
                </p>
              )}
            </MotionSection>
          ) : null}

          {showDva ? (
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
                    void refetchWallet();
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
                  <DetailRow label="Currency" value={deposit.currency} />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {deposit.instructions}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Deposit account unavailable. Try refresh.
                </p>
              )}

              {checkoutAvailable ? (
                <button
                  type="button"
                  onClick={() => {
                    setPreferCheckout(true);
                    setConfirming(false);
                  }}
                  className="mt-4 w-full text-center text-sm font-semibold text-primary"
                >
                  Prefer card deposit?
                </button>
              ) : null}
            </MotionSection>
          ) : null}

          {deposit && !preferCheckout ? (
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

          {!showCheckout && !showDva && !showIdentity && error ? (
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

function DetailPlain({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-semibold",
          emphasize && "text-oryno-orange",
        )}
      >
        {value}
      </span>
    </div>
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
