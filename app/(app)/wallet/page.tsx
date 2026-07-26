"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Landmark,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { TransactionRow } from "@/components/app/transaction-row";
import { WalletSkeleton } from "@/components/app/wallet-skeleton";
import { DEMO_BANKS, type WalletPayload } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

export default function WalletPage() {
  const [data, setData] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankName, setBankName] = useState<string>(DEMO_BANKS[0]);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load wallet");
      const json = (await res.json()) as WalletPayload;
      setData(json);
      setAccountName((prev) => prev || json.user.fullName || "");
    } catch {
      setError("Couldn’t load your wallet. Pull to retry.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAddAccount(e: FormEvent) {
    e.preventDefault();
    setSavingBank(true);
    setBankError(null);
    try {
      const res = await fetch("/api/wallet/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountName, accountNumber }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setAccountNumber("");
      setAdding(false);
      setFlash("Bank account added");
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
    await fetch(`/api/wallet/banks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await load({ soft: true });
  }

  const currency = data?.totals.currency ?? "NGN";
  const symbol =
    currency === "NGN"
      ? "₦"
      : currency === "GHS"
        ? "GH₵"
        : currency === "KES"
          ? "KSh"
          : currency === "ZAR"
            ? "R"
            : `${currency} `;

  return (
    <AppShell>
      <PageHeader
        title="My Wallet"
        subtitle="Balance, payout banks & recent activity"
        backHref="/dashboard"
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)]"
            aria-label="Refresh wallet"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 text-foreground",
                loading && "animate-spin",
              )}
              strokeWidth={1.75}
            />
          </button>
        }
      />

      {loading && !data ? (
        <WalletSkeleton />
      ) : error && !data ? (
        <MotionSection className="rounded-[28px] border border-border bg-background px-6 py-14 text-center shadow-[var(--shadow-soft)]">
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
          <MotionSection className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] px-5 py-5 text-white sm:px-6 sm:py-6">
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
                    <Sparkles className="h-3.5 w-3.5 text-[#ffd29a]" />
                    Primary · {currency}
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={hidden ? "h" : data.primary.balanceFormatted}
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -6 }}
                      className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
                    >
                      {hidden ? "••••••••" : data.primary.balanceFormatted}
                    </motion.p>
                  </AnimatePresence>
                  <p className="mt-1.5 text-sm text-white/85">
                    {data.user.fullName} · {data.user.countryCode} wallet
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-bold text-[#ffd29a] ring-1 ring-white/20">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {data.primary.status === "healthy" ? "Protected" : data.primary.status}
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

              <div className="relative mt-5 grid grid-cols-2 gap-2.5">
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
          </MotionSection>

          <MotionSection delay={0.06} className="mt-4 grid grid-cols-3 gap-3">
            {[
              {
                label: "Balance",
                value: hidden ? "••••" : `${symbol}${Number(data.totals.balance).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`,
                icon: Zap,
              },
              {
                label: "Banks",
                value: String(data.totals.bankCount),
                icon: Landmark,
              },
              {
                label: "Recent",
                value: String(data.recent.length),
                icon: Sparkles,
              },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.04 }}
                  className="rounded-[22px] border border-border bg-background p-3.5 shadow-[var(--shadow-soft)] sm:p-4"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-oryno-orange-muted text-primary">
                    <Icon className="h-4 w-4" />
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

          <MotionSection
            delay={0.1}
            className="mt-5 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
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
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="mt-2 h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      >
                        {DEMO_BANKS.map((bank) => (
                          <option key={bank} value={bank}>
                            {bank}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-foreground">
                        Account name
                      </span>
                      <input
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        required
                        className="mt-2 h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-foreground">
                        Account number
                      </span>
                      <input
                        inputMode="numeric"
                        value={accountNumber}
                        onChange={(e) =>
                          setAccountNumber(
                            e.target.value.replace(/[^\d]/g, "").slice(0, 10),
                          )
                        }
                        placeholder="10-digit account number"
                        required
                        className="mt-2 h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={savingBank || accountNumber.length < 10}
                      className="btn-primary h-11 w-full text-sm disabled:opacity-50"
                    >
                      {savingBank ? "Saving…" : "Save bank account"}
                    </button>
                  </div>
                </motion.form>
              ) : null}
            </AnimatePresence>

            <div className="space-y-3">
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
                        onClick={() => void removeAccount(account.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border text-muted-foreground transition hover:border-[var(--oryno-error)] hover:text-[var(--oryno-error)]"
                        aria-label="Remove bank account"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
                    Add a local bank to withdraw from your wallet.
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
          </MotionSection>

          <MotionSection
            delay={0.14}
            className="mt-5 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Recent activity
              </h2>
              <Link href="/history" className="text-sm font-semibold text-primary">
                See all
              </Link>
            </div>
            {data.recent.length ? (
              <div className="divide-y divide-border">
                {data.recent.map((tx, i) => (
                  <TransactionRow key={tx.id} transaction={tx} index={i} />
                ))}
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-border px-4 py-10 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No transactions yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fund your wallet to get started.
                </p>
                <Link
                  href="/fund"
                  className="btn-primary mt-4 inline-flex h-10 items-center px-4 text-sm"
                >
                  Fund wallet
                </Link>
              </div>
            )}
          </MotionSection>
        </>
      ) : null}
    </AppShell>
  );
}
