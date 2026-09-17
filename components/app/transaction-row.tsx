"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Percent,
  Phone,
  Smartphone,
  Store,
  TrendingUp,
  Trophy,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AppTransaction } from "@/lib/transactions";
import { formatAbsoluteWhen, statusDisplayLabel } from "@/lib/history";
import { cn } from "@/lib/utils";

export type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  type: "credit" | "debit";
  status?: "Completed" | "Pending" | "Failed" | "Reversed";
  category?: string;
  createdAt?: string;
};

type Props = {
  transaction: Transaction | AppTransaction;
  index?: number;
  href?: string;
};

type IconMeta = {
  Icon: LucideIcon;
  tone: string;
};

function iconForTransaction(tx: Transaction | AppTransaction): IconMeta {
  const cat = ("category" in tx ? tx.category : undefined)?.toLowerCase() ?? "";
  const credit = tx.type === "credit";

  if (cat === "data") {
    return { Icon: Wifi, tone: "bg-primary/12 text-primary" };
  }
  if (cat === "airtime") {
    return { Icon: Smartphone, tone: "bg-primary/12 text-primary" };
  }
  if (cat === "bill" || cat === "bills" || cat === "electricity") {
    return { Icon: Zap, tone: "bg-amber-500/12 text-amber-600" };
  }
  if (cat === "gift_card" || cat === "giftcard") {
    return { Icon: Gift, tone: "bg-primary/12 text-primary" };
  }
  if (cat === "referral" || cat === "cashback") {
    return { Icon: Gift, tone: "bg-oryno-success/12 text-oryno-success" };
  }
  if (cat === "social") {
    return { Icon: TrendingUp, tone: "bg-violet-500/12 text-violet-600" };
  }
  if (cat === "betting") {
    return { Icon: Trophy, tone: "bg-emerald-500/12 text-emerald-600" };
  }
  if (cat === "virtual_number" || cat === "numbers" || cat === "email") {
    return { Icon: Phone, tone: "bg-sky-500/12 text-sky-600" };
  }
  if (cat === "fee") {
    return { Icon: Percent, tone: "bg-violet-500/12 text-violet-600" };
  }
  if (cat === "fund" || cat === "refund") {
    return { Icon: ArrowDownLeft, tone: "bg-oryno-success/12 text-oryno-success" };
  }
  if (cat === "withdraw" || cat === "transfer") {
    return credit
      ? { Icon: ArrowDownLeft, tone: "bg-oryno-success/12 text-oryno-success" }
      : { Icon: ArrowUpRight, tone: "bg-primary/12 text-primary" };
  }
  if (cat === "convert" || cat === "usd") {
    return { Icon: Store, tone: "bg-primary/12 text-primary" };
  }

  return credit
    ? { Icon: ArrowDownLeft, tone: "bg-oryno-success/12 text-oryno-success" }
    : { Icon: ArrowUpRight, tone: "bg-primary/12 text-primary" };
}

function amountClass(tx: Transaction | AppTransaction) {
  return tx.type === "credit"
    ? "text-[var(--oryno-success)]"
    : "text-foreground";
}

function statusBadge(status: string) {
  const label = statusDisplayLabel(status);
  if (status === "Failed") {
    return {
      label: "Failed",
      className: "bg-destructive/10 text-destructive",
    };
  }
  if (status === "Reversed") {
    return {
      label: "Reversed",
      className: "bg-muted text-muted-foreground",
    };
  }
  if (status === "Pending") {
    return {
      label: "Pending",
      className: "bg-oryno-orange-muted text-primary",
    };
  }
  return {
    label: label === "Completed" ? "Successful" : label,
    className: "bg-oryno-success/12 text-oryno-success",
  };
}

export function TransactionRow({
  transaction,
  index = 0,
  href,
}: Props) {
  const credit = transaction.type === "credit";
  const status = transaction.status ?? "Completed";
  const to = href ?? `/history/${transaction.id}`;
  const { Icon, tone } = iconForTransaction(transaction);
  const badge = statusBadge(status);
  const when =
    "createdAt" in transaction && transaction.createdAt
      ? formatAbsoluteWhen(transaction.createdAt)
      : transaction.subtitle;
  const subtitle =
    "category" in transaction &&
    (transaction.category === "virtual_number" ||
      transaction.category === "numbers")
      ? "Tap to get SMS code"
      : when;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.25 }}
    >
      <Link
        href={to}
        className="group flex w-full items-center gap-3 px-1 py-3.5 text-left transition-colors hover:bg-muted/40 active:bg-muted/60 sm:px-1.5"
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            tone,
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {transaction.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <p
            className={cn(
              "text-[15px] font-bold tabular-nums",
              amountClass(transaction),
            )}
          >
            {transaction.amount.startsWith("+") ||
            transaction.amount.startsWith("-")
              ? transaction.amount
              : `${credit ? "+" : "-"}${transaction.amount}`}
          </p>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              badge.className,
            )}
          >
            {badge.label}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
