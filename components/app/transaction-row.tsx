"use client";

import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  type: "credit" | "debit";
  status?: "Completed" | "Pending" | "Failed";
};

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const credit = transaction.type === "credit";
  const statusColor =
    transaction.status === "Failed"
      ? "text-oryno-error"
      : transaction.status === "Pending"
        ? "text-primary"
        : "text-oryno-success";

  return (
    <motion.div
      whileHover={{ x: 2 }}
      className="flex items-center gap-3 rounded-[14px] px-2 py-3.5 transition-colors hover:bg-muted/60"
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          credit
            ? "bg-oryno-success/12 text-oryno-success"
            : "bg-oryno-error/10 text-oryno-error",
        )}
      >
        {credit ? (
          <ArrowDownLeft className="h-5 w-5" strokeWidth={2} />
        ) : (
          <ArrowUpRight className="h-5 w-5" strokeWidth={2} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {transaction.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {transaction.subtitle}
        </p>
      </div>
      <div className="text-right">
        <p
          className={cn(
            "text-sm font-semibold",
            credit ? "text-oryno-success" : "text-foreground",
          )}
        >
          {transaction.amount}
        </p>
        {transaction.status ? (
          <p className={cn("text-[11px] font-medium", statusColor)}>
            • {transaction.status}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}
