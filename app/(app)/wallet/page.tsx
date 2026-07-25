"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  Check,
  Landmark,
  Plus,
  Search,
  ShieldCheck,
  ArrowUpRight,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { TransactionRow } from "@/components/app/transaction-row";
import { walletHistory } from "@/lib/demo-data";
import { activeCountryConfig } from "@/lib/services-catalog";
import { cn } from "@/lib/utils";

type BankAccount = {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  primary?: boolean;
};

const banks = [
  "Access Bank",
  "GTBank",
  "Kuda",
  "Zenith Bank",
  "UBA",
  "First Bank",
  "Opay",
  "Palmpay",
];

export default function WalletPage() {
  const { currency, currencySymbol, name: countryName, code } =
    activeCountryConfig;

  const [accounts, setAccounts] = useState<BankAccount[]>([
    {
      id: "ba1",
      bankName: "Kuda",
      accountName: "Chidi Benson",
      accountNumber: "1045920394",
      primary: true,
    },
  ]);
  const [adding, setAdding] = useState(false);
  const [bankName, setBankName] = useState(banks[0]);
  const [accountName, setAccountName] = useState("Chidi Benson");
  const [accountNumber, setAccountNumber] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  function onAddAccount(e: FormEvent) {
    e.preventDefault();
    if (accountNumber.replace(/\D/g, "").length < 10) return;

    setAccounts((prev) => [
      ...prev,
      {
        id: `ba-${Date.now()}`,
        bankName,
        accountName: accountName.trim() || "Account holder",
        accountNumber: accountNumber.replace(/\D/g, "").slice(0, 10),
        primary: prev.length === 0,
      },
    ]);
    setAccountNumber("");
    setAdding(false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  }

  function setPrimary(id: string) {
    setAccounts((prev) =>
      prev.map((account) => ({
        ...account,
        primary: account.id === id,
      })),
    );
  }

  function removeAccount(id: string) {
    setAccounts((prev) => {
      const next = prev.filter((account) => account.id !== id);
      if (next.length && !next.some((a) => a.primary)) {
        next[0] = { ...next[0], primary: true };
      }
      return next;
    });
  }

  return (
    <AppShell>
      <PageHeader
        title="My Wallets"
        subtitle={`${countryName} · ${currency} wallet & payout accounts`}
        backHref="/dashboard"
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-[var(--shadow-soft)] sm:inline-flex">
              {currencySymbol} {currency}
            </span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)]"
              aria-label="Search wallets"
            >
              <Search className="h-5 w-5 text-foreground" strokeWidth={1.75} />
            </button>
          </div>
        }
      />

      <MotionSection className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <motion.div
          whileHover={{ y: -4 }}
          className="min-w-[230px] flex-1 rounded-[22px] bg-gradient-to-br from-oryno-orange to-oryno-orange-soft p-5 text-white shadow-[var(--shadow-orange)] sm:min-w-0"
        >
          <p className="text-xs text-white/85">
            {currency} · {countryName}
          </p>
          <p className="mt-2 text-2xl font-bold">{currencySymbol}1,245,600.00</p>
          <p className="mt-3 text-[11px] text-white/80">
            Primary wallet · {code}
          </p>
        </motion.div>
        <motion.div
          whileHover={{ y: -4 }}
          className="min-w-[230px] flex-1 rounded-[22px] bg-[#2563EB] p-5 text-white shadow-[var(--shadow-md)] sm:min-w-0"
        >
          <p className="text-xs text-white/85">USD · Total balance</p>
          <p className="mt-2 text-2xl font-bold">$2,450.00</p>
          <p className="mt-3 text-[11px] text-white/80">Multi-currency ready</p>
        </motion.div>
      </MotionSection>

      <MotionSection
        delay={0.08}
        className="mt-6 rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Total Balance ({currency} Equivalent)
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {currencySymbol}1,245,600.00
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all your currency wallets · Updated just now
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-oryno-orange-muted px-2.5 py-1 text-[11px] font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Protected
          </span>
        </div>
      </MotionSection>

      <MotionSection delay={0.12} className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href="/fund"
          className="btn-primary inline-flex h-12 items-center justify-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Fund
        </Link>
        <Link
          href="/withdraw"
          className="btn-secondary inline-flex h-12 items-center justify-center gap-2 text-sm"
        >
          <ArrowUpRight className="h-4 w-4" />
          Withdraw
        </Link>
      </MotionSection>

      <MotionSection
        delay={0.16}
        className="mt-6 rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
              <Landmark className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Bank accounts
              </h2>
              <p className="text-sm text-muted-foreground">
                For withdrawals in {countryName}
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
          {savedFlash ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 flex items-center gap-2 rounded-[14px] bg-oryno-orange-muted px-3 py-2.5 text-sm font-medium text-primary"
            >
              <Check className="h-4 w-4" />
              Bank account added successfully
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
                <label className="block">
                  <span className="text-sm font-semibold text-foreground">
                    Bank
                  </span>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="mt-2 h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  >
                    {banks.map((bank) => (
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
                      setAccountNumber(e.target.value.replace(/[^\d]/g, "").slice(0, 10))
                    }
                    placeholder="10-digit account number"
                    required
                    className="mt-2 h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>

                <motion.button
                  type="submit"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={accountNumber.length < 10}
                  className="btn-primary h-11 w-full text-sm disabled:opacity-50"
                >
                  Save bank account
                </motion.button>
              </div>
            </motion.form>
          ) : null}
        </AnimatePresence>

        <div className="space-y-3">
          {accounts.map((account, index) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={cn(
                "rounded-[18px] border px-4 py-3.5",
                account.primary
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
                      {account.primary ? (
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
                  {!account.primary ? (
                    <button
                      type="button"
                      onClick={() => setPrimary(account.id)}
                      className="text-xs font-semibold text-primary"
                    >
                      Make primary
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeAccount(account.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border text-muted-foreground transition hover:border-[var(--oryno-error)] hover:text-[var(--oryno-error)]"
                    aria-label="Remove bank account"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {accounts.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-semibold text-foreground">
                No bank accounts yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a local bank account to withdraw from your wallet.
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
        delay={0.2}
        className="mt-6 rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {currency} Wallet History
          </h2>
          <Link href="/history" className="text-sm font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="divide-y divide-border">
          {walletHistory.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
        </div>
      </MotionSection>
    </AppShell>
  );
}
