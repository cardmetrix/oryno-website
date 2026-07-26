"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import type { AppTransaction } from "@/lib/transactions";
import { cn } from "@/lib/utils";

export type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  type: "credit" | "debit";
  status?: "Completed" | "Pending" | "Failed";
};

type Props = {
  transaction: Transaction | AppTransaction;
  index?: number;
  href?: string;
};

export function TransactionRow({
  transaction,
  index = 0,
  href,
}: Props) {
  const credit = transaction.type === "credit";
  const status = transaction.status ?? "Completed";
  const to = href ?? `/history/${transaction.id}`;

  const statusMeta =
    status === "Failed"
      ? {
          label: "Failed",
          className: "bg-destructive/10 text-destructive",
          Icon: XCircle,
        }
      : status === "Pending"
        ? {
            label: "Pending",
            className: "bg-oryno-orange-muted text-primary",
            Icon: Clock3,
          }
        : {
            label: "Completed",
            className: "bg-oryno-success/12 text-oryno-success",
            Icon: CheckCircle2,
          };

  const StatusIcon = statusMeta.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.24), duration: 0.28 }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
    >
      <Link
        href={to}
        className="group flex w-full items-center gap-3 rounded-[18px] px-2.5 py-3 text-left transition-colors hover:bg-muted/70 active:bg-muted sm:px-3"
      >
        <span
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-[var(--shadow-soft)] ring-1 ring-black/5",
            credit
              ? "bg-oryno-success/12 text-oryno-success"
              : "bg-oryno-orange-muted text-primary",
          )}
        >
          {credit ? (
            <ArrowDownLeft className="h-5 w-5" strokeWidth={2} />
          ) : (
            <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {transaction.title}
            </p>
            <p
              className={cn(
                "shrink-0 text-sm font-bold tabular-nums",
                credit ? "text-oryno-success" : "text-foreground",
              )}
            >
              {transaction.amount}
            </p>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground">
              {transaction.subtitle}
            </p>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                statusMeta.className,
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {statusMeta.label}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
