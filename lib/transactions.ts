export type TransactionStatus = "Completed" | "Pending" | "Failed";

export type AppTransaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  type: "credit" | "debit";
  status: TransactionStatus;
  category?: string;
  currency?: string;
  createdAt: string;
};

export type TransactionGroup = {
  date: string;
  items: AppTransaction[];
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦",
  GHS: "GH₵",
  KES: "KSh",
  ZAR: "R",
  USD: "$",
};

export function formatMoney(amount: string | number, currency = "NGN") {
  const value = typeof amount === "number" ? amount : Number(amount);
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const formatted = Number.isFinite(value)
    ? Math.abs(value).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
  return `${symbol}${formatted}`;
}

export function mapDbStatus(
  status: string,
): TransactionStatus {
  if (status === "completed") return "Completed";
  if (status === "failed" || status === "reversed" || status === "cancelled") {
    return "Failed";
  }
  return "Pending";
}

export function groupTransactionsByDate(
  items: AppTransaction[],
): TransactionGroup[] {
  const groups = new Map<string, AppTransaction[]>();

  for (const item of items) {
    const key = formatGroupLabel(item.createdAt);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  return Array.from(groups.entries()).map(([date, groupItems]) => ({
    date,
    items: groupItems,
  }));
}

function formatGroupLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "EARLIER";

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86_400_000,
  );

  const pretty = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });

  if (diffDays === 0) return `TODAY · ${pretty}`;
  if (diffDays === 1) return `YESTERDAY · ${pretty}`;
  return pretty.toUpperCase();
}
