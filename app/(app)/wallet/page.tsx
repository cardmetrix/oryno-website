"use client";

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  Check,
  Clock,
  Eye,
  EyeOff,
  History,
  Landmark,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { UsdWalletActionsPanel, UsdWalletCard, type UsdPanel } from "@/components/app/usd-wallet-card";
import { WalletSkeleton } from "@/components/app/wallet-skeleton";
import { WalletBalanceAmount } from "@/components/app/wallet-balance-amount";
import { fetchWallet, useWallet } from "@/hooks/use-wallet";
import { WALLET_QUERY_KEY } from "@/lib/query-keys";
import type { BankAccountSummary, BankOption, WalletPayload } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DEFAULT_ACCOUNT_RULES = {
  min: 10,
  max: 10,
  label: "10-digit account number",
  hint: "Nigerian NUBAN",
};

export default function WalletPage() {
  return (
    <Suspense fallback={<WalletPageFallback />}>
      <WalletPageContent />
    </Suspense>
  );
}

function WalletPageFallback() {
  return (
    <AppShell>
      <PageHeader
        title="My Wallet"
        subtitle="Balance, payout banks & recent activity"
        backHref="/dashboard"
      />
      <WalletSkeleton />
    </AppShell>
  );
}

function WalletPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: walletData } = useWallet();
  const [data, setData] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [bankOptions, setBankOptions] = useState<BankOption[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountRules, setAccountRules] = useState(DEFAULT_ACCOUNT_RULES);
  const [nameEditable, setNameEditable] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [removingBankId, setRemovingBankId] = useState<string | null>(null);
  /** Mobile wallet pager: only one currency card is in view at a time */
  const [walletView, setWalletView] = useState<"local" | "usd">("local");
  const [usdPanel, setUsdPanel] = useState<UsdPanel>("fund");
  const walletPagerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (opts?: { soft?: boolean; wallet?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const refreshWallet = opts?.wallet !== false;
      const [json, banksRes] = await Promise.all([
        refreshWallet
          ? queryClient.fetchQuery({
              queryKey: WALLET_QUERY_KEY,
              queryFn: fetchWallet,
              staleTime: 0,
            })
          : Promise.resolve(
              walletData ??
                queryClient.getQueryData<WalletPayload>(WALLET_QUERY_KEY) ??
                queryClient.fetchQuery({
                  queryKey: WALLET_QUERY_KEY,
                  queryFn: fetchWallet,
                  staleTime: 20_000,
                }),
            ),
        fetch("/api/wallet/banks", { cache: "no-store" }),
      ]);
      if (!json) throw new Error("Failed to load wallet");
      setData(json);

      if (banksRes.ok) {
        const banksJson = (await banksRes.json()) as {
          options?: BankOption[];
          accountRules?: typeof DEFAULT_ACCOUNT_RULES;
        };
        const options = banksJson.options ?? [];
        setBankOptions(options);
        setBankCode((prev) => prev || options[0]?.code || "");
        if (banksJson.accountRules) setAccountRules(banksJson.accountRules);
      }
    } catch {
      setError("Couldn’t load your wallet. Pull to retry.");
      if (!walletData) setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryClient, walletData]);

  useEffect(() => {
    if (walletData) {
      setData(walletData);
      setLoading(false);
    }
  }, [walletData]);

  useEffect(() => {
    if (walletData) {
      void load({ soft: true, wallet: false });
      return;
    }
    void load();
    // initial page load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flutterwave local wallet funding callback: /wallet?local_fund=1&tx_ref=...
  useEffect(() => {
    const localFund = searchParams.get("local_fund");
    const reference =
      searchParams.get("tx_ref") ||
      searchParams.get("reference") ||
      searchParams.get("trxref");
    const transactionId =
      searchParams.get("transaction_id") || searchParams.get("transactionId");
    if (!localFund || (!reference && !transactionId)) return;

    let cancelled = false;
    (async () => {
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
        toast.success("Wallet funded", {
          description: json.amountFormatted,
        });
        await load({ soft: true });
        router.replace(
          json.transactionId
            ? `/history/${json.transactionId}`
            : "/wallet",
        );
      } catch (err) {
        if (cancelled) return;
        toast.error(
          err instanceof Error ? err.message : "Payment verification failed",
        );
        router.replace("/wallet");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, load, router]);

  // Flutterwave USD funding callback: /wallet?usd_fund=1&tx_ref=...
  useEffect(() => {
    const usdFund = searchParams.get("usd_fund");
    const reference =
      searchParams.get("tx_ref") ||
      searchParams.get("reference") ||
      searchParams.get("trxref");
    const flwTransactionId =
      searchParams.get("transaction_id") || searchParams.get("transactionId");
    if (!usdFund || (!reference && !flwTransactionId)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wallet/usd/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference,
            transactionId: flwTransactionId,
          }),
        });
        const json = (await res.json()) as {
          error?: string;
          transactionId?: string;
          amountFormatted?: string;
        };
        if (!res.ok) throw new Error(json.error || "Could not verify payment");
        if (cancelled) return;
        toast.success("USD wallet funded", {
          description: json.amountFormatted,
        });
        await load({ soft: true });
        router.replace(
          json.transactionId
            ? `/history/${json.transactionId}`
            : "/wallet",
        );
      } catch (err) {
        if (cancelled) return;
        toast.error(
          err instanceof Error ? err.message : "USD payment verification failed",
        );
        router.replace("/wallet");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, load, router]);

  useEffect(() => {
    if (!adding || accountNumber.length < accountRules.min || !bankCode) return;

    const timer = window.setTimeout(async () => {
      setResolving(true);
      setBankError(null);
      try {
        const res = await fetch("/api/wallet/banks/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bankCode, accountNumber }),
        });
        const json = (await res.json()) as {
          error?: string;
          accountName?: string;
          unresolved?: boolean;
          message?: string;
        };
        if (!res.ok) throw new Error(json.error || "Could not verify account");
        setAccountName(json.accountName ?? "");
        setNameEditable(Boolean(json.unresolved) || !json.accountName);
        if (json.unresolved && json.message) {
          setBankError(json.message);
        }
      } catch (err) {
        setAccountName("");
        setNameEditable(true);
        setBankError(
          err instanceof Error
            ? err.message
            : "Could not verify account — enter the name manually",
        );
      } finally {
        setResolving(false);
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [adding, accountNumber, bankCode, accountRules.min]);

  async function onAddAccount(e: FormEvent) {
    e.preventDefault();
    setSavingBank(true);
    setBankError(null);
    try {
      const selected = bankOptions.find((b) => b.code === bankCode);
      const res = await fetch("/api/wallet/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankCode,
          bankName: selected?.name,
          accountName,
          accountNumber,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setAccountNumber("");
      setAccountName("");
      setAdding(false);
      setFlash("Bank account verified & saved");
      window.setTimeout(() => setFlash(null), 2200);
      await load({ soft: true });
    } catch (err) {
      setBankError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingBank(false);
    }
  }

  async function setPrimary(id: string) {
    await fetch("/api/wallet/banks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, makePrimary: true }),
    });
    await load({ soft: true });
  }

  async function removeAccount(id: string) {
    setRemovingBankId(id);
    setBankError(null);
    try {
      const res = await fetch(`/api/wallet/banks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as {
        error?: string;
        banks?: BankAccountSummary[];
      };
      if (!res.ok) {
        throw new Error(json.error || "Failed to remove bank account");
      }

      if (json.banks) {
        setData((current) =>
          current
            ? {
                ...current,
                banks: json.banks!,
                totals: {
                  ...current.totals,
                  bankCount: json.banks!.length,
                },
              }
            : current,
        );
      } else {
        await load({ soft: true });
      }

      setFlash("Bank account removed");
      window.setTimeout(() => setFlash(null), 2200);
      toast.success("Bank account removed");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to remove bank account";
      setBankError(message);
      toast.error(message);
    } finally {
      setRemovingBankId(null);
    }
  }

  const currency = data?.totals.currency ?? "NGN";
  const localBalance = Number(data?.primary.balance ?? 0);
  const usdBalance = Number(
    data?.usd?.balance ?? data?.totals.usdBalance ?? 0,
  );

  return (
    <AppShell>
      <PageHeader
        title="My Wallet"
        subtitle="Balance, payout banks & recent activity"
        backHref="/dashboard"
        actions={
          <Link
            href="/history"
            className="inline-flex h-10 items-center justify-center gap-1.5 px-3.5 text-sm font-bold transition hover:opacity-80"
            style={{ color: "#ff6a00" }}
            aria-label="Transaction history"
          >
            <History className="h-4 w-4" strokeWidth={1.75} />
            History
          </Link>
        }
      />

      {loading && !data ? (
        <WalletSkeleton />
      ) : error && !data ? (
        <MotionSection className="rounded-[28px] bg-background px-6 py-14 text-center shadow-[var(--shadow-soft)]">
          <p className="text-lg font-bold text-foreground">Wallet unavailable</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-primary mt-5 h-11 px-5 text-sm"
          >
            Retry
          </button>
        </MotionSection>
      ) : data ? (
        <>
          <div className="-mx-4 sm:-mx-6 md:mx-0">
            <div
              ref={walletPagerRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (window.matchMedia("(min-width: 768px)").matches) return;
                const idx = Math.round(
                  el.scrollLeft / Math.max(el.clientWidth, 1),
                );
                setWalletView(idx >= 1 ? "usd" : "local");
              }}
              className={cn(
                "flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
                "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                "md:grid md:grid-cols-2 md:items-stretch md:gap-4 md:overflow-visible md:snap-none md:auto-rows-fr",
              )}
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <MotionSection
                className={cn(
                  "box-border w-full min-w-full max-w-full shrink-0 basis-full snap-start snap-always px-4 sm:px-6",
                  "md:flex md:h-auto md:min-h-full md:min-w-0 md:max-w-none md:basis-auto md:snap-none md:flex-col md:px-0",
                )}
              >
                <div className="flex min-h-full flex-1 flex-col overflow-hidden rounded-[28px] bg-background shadow-[var(--shadow-soft)]">
                  <div className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] px-5 py-5 text-white sm:px-6 sm:py-6">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-12 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl"
                    />
                    <motion.div
                      aria-hidden="true"
                      animate={{ x: ["-30%", "130%"] }}
                      transition={{
                        duration: 4.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                        repeatDelay: 2,
                      }}
                      className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    />

                    <div className="relative flex items-start justify-between gap-3">
                      <div>
                        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-white/80 uppercase">
                          Primary · {currency}
                        </p>
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={hidden ? "h" : data.primary.balance}
                            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -6 }}
                            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
                          >
                            <WalletBalanceAmount
                              balance={data.primary.balance}
                              currency={data.primary.currency}
                              countryCode={data.user.countryCode}
                              hidden={hidden}
                            />
                          </motion.div>
                        </AnimatePresence>
                        <p className="mt-1.5 text-sm text-white/85">
                         {data.user.countryCode} wallet
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-bold text-[#ffd29a] ring-1 ring-white/20">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {data.primary.status === "healthy"
                            ? "Protected"
                            : data.primary.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setHidden((v) => !v)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/20 ring-1 ring-white/20"
                          aria-label={hidden ? "Show balance" : "Hide balance"}
                        >
                          {hidden ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="relative mt-5 grid grid-cols-2 gap-2.5 md:mt-auto md:pt-5">
                      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                        <Link
                          href="/fund"
                          className="flex h-[50px] items-center justify-center gap-2 rounded-[16px] bg-white font-bold text-black shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
                        >
                          <Plus className="h-4 w-4 text-black" strokeWidth={2.5} />
                          <span className="text-black">Fund</span>
                        </Link>
                      </motion.div>
                      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                        <Link
                          href="/withdraw"
                          className="flex h-[50px] items-center justify-center gap-2 rounded-[16px] bg-black/25 font-bold text-white ring-1 ring-white/25 backdrop-blur-md"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          Withdraw
                        </Link>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </MotionSection>

              <div
                className={cn(
                  "box-border w-full min-w-full max-w-full shrink-0 basis-full snap-start snap-always px-4 sm:px-6",
                  "md:flex md:h-auto md:min-h-full md:min-w-0 md:max-w-none md:basis-auto md:snap-none md:flex-col md:px-0",
                )}
              >
                <UsdWalletCard
                  usd={data.usd}
                  hidden={hidden}
                  holderName={data.user.fullName}
                  panel={usdPanel}
                  onPanelChange={setUsdPanel}
                  className="min-h-full flex-1"
                />
              </div>
            </div>

            {/* Dots + hint — always under the cards (mobile) */}
            <div className="mt-2.5 flex flex-col items-center gap-2 px-4 md:hidden sm:px-6">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Show local wallet"
                  onClick={() => {
                    setWalletView("local");
                    walletPagerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
                  }}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    walletView === "local"
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted-foreground/35",
                  )}
                />
                <button
                  type="button"
                  aria-label="Show USD wallet"
                  onClick={() => {
                    setWalletView("usd");
                    const el = walletPagerRef.current;
                    if (el) {
                      el.scrollTo({ left: el.clientWidth, behavior: "smooth" });
                    }
                  }}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    walletView === "usd"
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted-foreground/35",
                  )}
                />
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={walletView}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-[11px] text-muted-foreground"
                >
                  {walletView === "local"
                    ? "Swipe for USD wallet"
                    : "Swipe for local wallet"}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile: USD fund/convert panel under dots (like app) */}
          {walletView === "usd" ? (
            <div className="mt-3 md:hidden">
              <UsdWalletActionsPanel
                localCurrency={currency}
                localBalance={localBalance}
                localBalanceFormatted={data.primary.balanceFormatted}
                usdBalance={usdBalance}
                fx={data.fx}
                panel={usdPanel}
                onPanelChange={setUsdPanel}
                onUpdated={() => void load({ soft: true })}
              />
            </div>
          ) : null}

          {/* md+: stats full width, then equal-height bank + USD cards */}
          <div className="mt-4 hidden md:block">
            <MotionSection delay={0.06} className="grid grid-cols-3 gap-3">
              {[
                {
                  label: "Balance",
                  value: (
                    <WalletBalanceAmount
                      balance={data.primary.balance}
                      currency={data.primary.currency}
                      countryCode={data.user.countryCode}
                      hidden={hidden}
                    />
                  ),
                  icon: Wallet,
                },
                {
                  label: "Banks",
                  value: String(data.totals.bankCount),
                  icon: Landmark,
                },
                {
                  label: "Recent",
                  value: String(data.recent.length),
                  icon: Clock,
                },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.04 }}
                    className="rounded-[22px] bg-background p-3.5 shadow-[var(--shadow-soft)] sm:p-4"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-oryno-orange-muted text-primary">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <p className="mt-2.5 text-[11px] font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-foreground sm:text-base">
                      {stat.value}
                    </p>
                  </motion.div>
                );
              })}
            </MotionSection>

            <div className="mt-4 grid grid-cols-2 items-stretch gap-4">
              <BankAccountsSection
                data={data}
                adding={adding}
                setAdding={setAdding}
                flash={flash}
                bankError={bankError}
                bankOptions={bankOptions}
                bankCode={bankCode}
                setBankCode={setBankCode}
                accountNumber={accountNumber}
                setAccountNumber={setAccountNumber}
                accountName={accountName}
                setAccountName={setAccountName}
                accountRules={accountRules}
                nameEditable={nameEditable}
                resolving={resolving}
                savingBank={savingBank}
                onAddAccount={onAddAccount}
                setPrimary={setPrimary}
                removeAccount={removeAccount}
                removingBankId={removingBankId}
                className="h-full"
              />
              <UsdWalletActionsPanel
                localCurrency={currency}
                localBalance={localBalance}
                localBalanceFormatted={data.primary.balanceFormatted}
                usdBalance={usdBalance}
                fx={data.fx}
                panel={usdPanel}
                onPanelChange={setUsdPanel}
                onUpdated={() => void load({ soft: true })}
                className="mt-0 h-full"
              />
            </div>
          </div>

          {/* Mobile: stats + banks under local wallet */}
          <div
            className={cn(
              "md:hidden",
              walletView === "usd" ? "hidden" : "block",
            )}
          >
            <MotionSection delay={0.06} className="mt-4 grid grid-cols-3 gap-3">
              {[
                {
                  label: "Balance",
                  value: (
                    <WalletBalanceAmount
                      balance={data.primary.balance}
                      currency={data.primary.currency}
                      countryCode={data.user.countryCode}
                      hidden={hidden}
                    />
                  ),
                  icon: Wallet,
                },
                {
                  label: "Banks",
                  value: String(data.totals.bankCount),
                  icon: Landmark,
                },
                {
                  label: "Recent",
                  value: String(data.recent.length),
                  icon: Clock,
                },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + i * 0.04 }}
                    className="rounded-[22px] bg-background p-3.5 shadow-[var(--shadow-soft)] sm:p-4"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-oryno-orange-muted text-primary">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <p className="mt-2.5 text-[11px] font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-foreground sm:text-base">
                      {stat.value}
                    </p>
                  </motion.div>
                );
              })}
            </MotionSection>

            <div className="mt-4">
              <BankAccountsSection
                data={data}
                adding={adding}
                setAdding={setAdding}
                flash={flash}
                bankError={bankError}
                bankOptions={bankOptions}
                bankCode={bankCode}
                setBankCode={setBankCode}
                accountNumber={accountNumber}
                setAccountNumber={setAccountNumber}
                accountName={accountName}
                setAccountName={setAccountName}
                accountRules={accountRules}
                nameEditable={nameEditable}
                resolving={resolving}
                savingBank={savingBank}
                onAddAccount={onAddAccount}
                setPrimary={setPrimary}
                removeAccount={removeAccount}
                removingBankId={removingBankId}
              />
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

function BankAccountsSection({
  data,
  adding,
  setAdding,
  flash,
  bankError,
  bankOptions,
  bankCode,
  setBankCode,
  accountNumber,
  setAccountNumber,
  accountName,
  setAccountName,
  accountRules,
  nameEditable,
  resolving,
  savingBank,
  onAddAccount,
  setPrimary,
  removeAccount,
  removingBankId,
  className,
}: {
  data: WalletPayload;
  adding: boolean;
  setAdding: React.Dispatch<React.SetStateAction<boolean>>;
  flash: string | null;
  bankError: string | null;
  bankOptions: BankOption[];
  bankCode: string;
  setBankCode: React.Dispatch<React.SetStateAction<string>>;
  accountNumber: string;
  setAccountNumber: React.Dispatch<React.SetStateAction<string>>;
  accountName: string;
  setAccountName: React.Dispatch<React.SetStateAction<string>>;
  accountRules: { min: number; max: number; label: string; hint: string };
  nameEditable: boolean;
  resolving: boolean;
  savingBank: boolean;
  onAddAccount: (e: FormEvent) => void | Promise<void>;
  setPrimary: (id: string) => void | Promise<void>;
  removeAccount: (id: string) => void | Promise<void>;
  removingBankId: string | null;
  className?: string;
}) {
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const accountToRemove = data.banks.find((b) => b.id === confirmRemoveId);

  return (
    <MotionSection
      delay={0.1}
      className={cn(
        "flex flex-col rounded-[28px] bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
            <Landmark className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Bank accounts
            </h2>
            <p className="text-sm text-muted-foreground">
              For instant withdrawals
            </p>
          </div>
        </div>
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setAdding((v) => !v)}
          className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-primary px-3.5 text-sm font-semibold text-white shadow-[var(--shadow-orange)]"
        >
          {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {adding ? "Close" : "Add bank"}
        </motion.button>
      </div>

      <AnimatePresence>
        {flash ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-2 rounded-[14px] bg-oryno-orange-muted px-3 py-2.5 text-sm font-medium text-primary"
          >
            <Check className="h-4 w-4" />
            {flash}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {adding ? (
          <motion.form
            onSubmit={onAddAccount}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="space-y-3 rounded-[18px] border border-border bg-muted/40 p-4">
              {bankError ? (
                <p className="text-sm font-medium text-destructive">
                  {bankError}
                </p>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-foreground">
                  Bank
                </span>
                <select
                  value={bankCode}
                  onChange={(e) => {
                    setBankCode(e.target.value);
                    setAccountName("");
                  }}
                  className="mt-2 h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  {bankOptions.map((bank, index) => (
                    <option key={`${bank.code}-${index}`} value={bank.code}>
                      {bank.name}
                      {bank.type === "mobile_money" ? " · MoMo" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-foreground">
                  {accountRules.label}
                </span>
                <input
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => {
                    setAccountNumber(
                      e.target.value
                        .replace(/[^\d]/g, "")
                        .slice(0, accountRules.max),
                    );
                    setAccountName("");
                  }}
                  placeholder={accountRules.hint}
                  required
                  className="mt-2 h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-foreground">
                  Account name
                </span>
                <div className="relative mt-2">
                  <input
                    value={accountName}
                    readOnly={!nameEditable}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder={
                      resolving
                        ? "Verifying account…"
                        : nameEditable
                          ? "Type the name on the account"
                          : "Resolved after account number"
                    }
                    className="h-12 w-full rounded-[14px] border border-border bg-background px-4 pr-10 text-sm outline-none"
                  />
                  {resolving ? (
                    <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                  ) : null}
                </div>
              </label>
              <button
                type="submit"
                disabled={
                  savingBank ||
                  resolving ||
                  accountNumber.length < accountRules.min ||
                  !accountName ||
                  !bankCode
                }
                className="btn-primary h-11 w-full text-sm disabled:opacity-50"
              >
                {savingBank ? "Saving…" : "Verify & save bank"}
              </button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <div className="min-h-0 flex-1 space-y-3">
        {data.banks.map((account, index) => (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className={cn(
              "rounded-[18px] border px-4 py-3.5",
              account.isPrimary
                ? "border-primary/40 bg-oryno-orange-muted/40"
                : "border-border bg-background",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background text-primary shadow-[var(--shadow-soft)]">
                  <Building2 className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {account.bankName}
                    </p>
                    {account.isPrimary ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                        Primary
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {account.accountName}
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold tracking-wide text-foreground">
                    {account.accountNumber}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {!account.isPrimary ? (
                  <button
                    type="button"
                    onClick={() => void setPrimary(account.id)}
                    className="text-xs font-semibold text-primary"
                  >
                    Make primary
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirmRemoveId(account.id)}
                  disabled={removingBankId === account.id}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-muted text-muted-foreground transition hover:bg-destructive/10 hover:text-[var(--oryno-error)] disabled:opacity-50"
                  aria-label={`Remove ${account.bankName} account`}
                >
                  {removingBankId === account.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {data.banks.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              No bank accounts yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a verified bank to withdraw from your wallet.
            </p>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn-primary mt-4 inline-flex h-10 items-center px-4 text-sm"
            >
              Add bank account
            </button>
          </div>
        ) : null}
      </div>

      <AlertDialog
        open={Boolean(confirmRemoveId)}
        onOpenChange={(open) => {
          if (!open && !removingBankId) setConfirmRemoveId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove bank account?</AlertDialogTitle>
            <AlertDialogDescription>
              {accountToRemove
                ? `This will remove ${accountToRemove.bankName} · ${accountToRemove.maskedNumber || accountToRemove.accountNumber} from your payout accounts.`
                : "This bank account will be removed from your payout accounts."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(removingBankId)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(removingBankId)}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!confirmRemoveId) return;
                void Promise.resolve(removeAccount(confirmRemoveId)).finally(() => {
                  setConfirmRemoveId(null);
                });
              }}
            >
              {removingBankId ? "Removing…" : "Remove account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MotionSection>
  );
}
