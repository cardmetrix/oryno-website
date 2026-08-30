import { convertNgnToLocal, type NgnLocalQuote } from "@/lib/fx/rates";

export type TransactionStatus = "Completed" | "Pending" | "Failed" | "Reversed";

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

export type TransactionReceipt = AppTransaction & {
  amountRaw: string;
  amountUnsigned: string;
  balanceAfter: string | null;
  balanceAfterFormatted: string | null;
  externalRef: string | null;
  reference: string;
  categoryLabel: string;
  statusRaw: string;
  createdAtFormatted: string;
  metadata: Record<string, unknown> | null;
};

type TransactionRowLike = {
  id: string;
  type: string;
  category: string;
  title: string;
  subtitle: string | null;
  amount: string | number;
  currency: string;
  status: string;
  balanceAfter: string | number | null;
  externalRef: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string;
};

function presentAmount(
  amount: string | number,
  storedCurrency: string,
  fx?: NgnLocalQuote | null,
) {
  const raw = typeof amount === "number" ? amount : Number(amount);
  if (fx && fx.to !== "NGN" && storedCurrency === "NGN") {
    const local = convertNgnToLocal(raw, fx.ngnToLocal);
    return { value: local, currency: fx.to, formatted: formatMoney(local, fx.to) };
  }
  return {
    value: raw,
    currency: storedCurrency,
    formatted: formatMoney(raw, storedCurrency),
  };
}

export function toAppTransaction(
  row: TransactionRowLike,
  fx?: NgnLocalQuote | null,
): AppTransaction {
  const credit = row.type === "credit";
  const presented = presentAmount(row.amount, row.currency, fx);
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || row.category.replace(/_/g, " "),
    amount: `${credit ? "+" : "-"}${presented.formatted}`,
    type: credit ? "credit" : "debit",
    status: mapDbStatus(row.status),
    category: row.category,
    currency: presented.currency,
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : row.createdAt.toISOString(),
  };
}

export function toTransactionReceipt(
  row: TransactionRowLike,
  fx?: NgnLocalQuote | null,
): TransactionReceipt {
  const base = toAppTransaction(row, fx);
  const meta = row.metadata ?? null;
  const metaRef =
    meta && typeof meta.reference === "string" ? meta.reference : null;
  const reference =
    row.externalRef ||
    metaRef ||
    `ORY-${row.id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;

  const created =
    typeof row.createdAt === "string"
      ? new Date(row.createdAt)
      : row.createdAt;

  return {
    ...base,
    amountRaw: String(presentAmount(row.amount, row.currency, fx).value),
    amountUnsigned: presentAmount(row.amount, row.currency, fx).formatted,
    balanceAfter:
      row.balanceAfter == null ? null : String(row.balanceAfter),
    balanceAfterFormatted:
      row.balanceAfter == null
        ? null
        : presentAmount(row.balanceAfter, row.currency, fx).formatted,
    externalRef: row.externalRef,
    reference,
    categoryLabel: row.category.replace(/_/g, " "),
    statusRaw: row.status,
    createdAtFormatted: created.toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    metadata: meta,
  };
}

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
  if (status === "reversed") return "Reversed";
  if (status === "failed" || status === "cancelled") {
    return "Failed";
  }
  return "Pending";
}

export function normalizeStatusLabel(
  status: string | TransactionStatus | undefined | null,
): TransactionStatus {
  if (!status) return "Pending";
  const raw = String(status).toLowerCase();
  if (raw === "completed" || raw === "successful" || raw === "success") {
    return "Completed";
  }
  if (raw === "reversed") return "Reversed";
  if (raw === "failed" || raw === "cancelled" || raw === "canceled") {
    return "Failed";
  }
  if (raw === "pending" || raw === "processing") return "Pending";
  if (
    status === "Completed" ||
    status === "Pending" ||
    status === "Failed" ||
    status === "Reversed"
  ) {
    return status;
  }
  return mapDbStatus(raw);
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
