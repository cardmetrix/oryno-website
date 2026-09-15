import type { AppTransaction } from "@/lib/transactions";
import { normalizeStatusLabel } from "@/lib/transactions";

export type HistoryMonth = {
  key: string; // YYYY-MM
  label: string; // Aug
  longLabel: string; // August 2026
  year: number;
  month: number; // 0-11
};

export type CategoryBreakdown = {
  id: string;
  label: string;
  count: number;
  inflow: number;
  outflow: number;
  total: number;
};

export type DaySeriesPoint = {
  key: string;
  label: string;
  inflow: number;
  outflow: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  fund: 'Wallet funding',
  withdraw: 'Withdrawals',
  airtime: 'Airtime',
  data: 'Mobile data',
  bill: 'Bills',
  bills: 'Bills',
  betting: 'Betting funding',
  gift_card: 'Gift cards',
  giftcard: 'Gift cards',
  social: 'Social boost',
  numbers: 'Virtual numbers',
  email: 'Temp emails',
  convert: 'FX convert',
  usd: 'USD wallet',
  transfer: 'Transfers',
  fee: 'Fees',
  referral: 'Referrals',
  other: 'Other',
};

export function parseAmount(raw: string | number | undefined | null) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const n = Number(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function currencySymbol(currency?: string | null) {
  const c = (currency ?? 'NGN').toUpperCase();
  if (c === 'NGN') return '₦';
  if (c === 'GHS') return 'GH₵';
  if (c === 'KES') return 'KSh';
  if (c === 'ZAR') return 'R';
  if (c === 'USD') return '$';
  return `${c} `;
}

export function formatMoneyAmount(
  value: number,
  currency?: string | null,
  opts?: { signed?: boolean; type?: 'credit' | 'debit' },
) {
  const symbol = currencySymbol(currency);
  const abs = Math.abs(value).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!opts?.signed) return `${symbol}${abs}`;
  const sign = opts.type === 'credit' || value > 0 ? '+' : '-';
  return `${sign}${symbol}${abs}`;
}

export function formatAbsoluteWhen(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;

  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  const month = date.toLocaleString('en-US', { month: 'short' });
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${month} ${day}${suffix}, ${time}`;
}

export function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildHistoryMonths(items: AppTransaction[]): HistoryMonth[] {
  const map = new Map<string, HistoryMonth>();
  const now = new Date();
  const currentKey = monthKeyFromDate(now);
  map.set(currentKey, {
    key: currentKey,
    label: now.toLocaleString('en-US', { month: 'short' }),
    longLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  for (const item of items) {
    const date = new Date(item.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = monthKeyFromDate(date);
    if (map.has(key)) continue;
    map.set(key, {
      key,
      label: date.toLocaleString('en-US', { month: 'short' }),
      longLabel: date.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      year: date.getFullYear(),
      month: date.getMonth(),
    });
  }

  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function categoryLabel(category?: string | null) {
  if (!category) return 'Other';
  const key = category.trim().toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_LABELS[key] ?? category.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function collectCategories(items: AppTransaction[]) {
  const set = new Map<string, string>();
  for (const item of items) {
    const id = (item.category ?? 'other').trim().toLowerCase() || 'other';
    if (!set.has(id)) set.set(id, categoryLabel(id));
  }
  return Array.from(set.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function filterHistoryItems(
  items: AppTransaction[],
  opts: {
    monthKey?: string | null;
    category?: string | null;
    status?: string | null;
    type?: 'all' | 'credit' | 'debit';
    query?: string;
  },
) {
  const q = opts.query?.trim().toLowerCase() ?? '';
  return items.filter((item) => {
    if (opts.monthKey) {
      const date = new Date(item.createdAt);
      if (Number.isNaN(date.getTime()) || monthKeyFromDate(date) !== opts.monthKey) {
        return false;
      }
    }
    if (opts.category && opts.category !== 'all') {
      const id = (item.category ?? 'other').trim().toLowerCase() || 'other';
      if (id !== opts.category) return false;
    }
    if (opts.status && opts.status !== 'all') {
      const status = normalizeStatusLabel(item.status);
      if (opts.status === 'successful' && status !== 'Completed') return false;
      if (opts.status === 'pending' && status !== 'Pending') return false;
      if (opts.status === 'failed' && status !== 'Failed') return false;
    }
    if (opts.type === 'credit' && item.type !== 'credit') return false;
    if (opts.type === 'debit' && item.type !== 'debit') return false;
    if (q) {
      const hay = `${item.title} ${item.subtitle} ${item.category ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function summarizeCashflow(items: AppTransaction[]) {
  let inflow = 0;
  let outflow = 0;
  for (const item of items) {
    const amount = Math.abs(parseAmount(item.amount));
    if (item.type === 'credit') inflow += amount;
    else outflow += amount;
  }
  return { inflow, outflow, net: inflow - outflow, count: items.length };
}

export function buildCategoryBreakdown(items: AppTransaction[]): CategoryBreakdown[] {
  const map = new Map<string, CategoryBreakdown>();
  for (const item of items) {
    const id = (item.category ?? 'other').trim().toLowerCase() || 'other';
    const current = map.get(id) ?? {
      id,
      label: categoryLabel(id),
      count: 0,
      inflow: 0,
      outflow: 0,
      total: 0,
    };
    const amount = Math.abs(parseAmount(item.amount));
    current.count += 1;
    if (item.type === 'credit') current.inflow += amount;
    else current.outflow += amount;
    current.total = current.inflow + current.outflow;
    map.set(id, current);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function buildDailySeries(items: AppTransaction[], monthKey: string): DaySeriesPoint[] {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return [];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const points: DaySeriesPoint[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${monthKey}-${String(day).padStart(2, '0')}`;
    points.push({
      key,
      label: String(day),
      inflow: 0,
      outflow: 0,
    });
  }

  for (const item of items) {
    const date = new Date(item.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    if (monthKeyFromDate(date) !== monthKey) continue;
    const idx = date.getDate() - 1;
    const amount = Math.abs(parseAmount(item.amount));
    if (item.type === 'credit') points[idx].inflow += amount;
    else points[idx].outflow += amount;
  }

  return points;
}

export function buildStatementCsv(
  items: AppTransaction[],
  opts: { currency?: string | null; periodLabel: string },
) {
  const header = [
    'Date',
    'Time',
    'Title',
    'Details',
    'Category',
    'Type',
    'Status',
    'Amount',
    'Currency',
    'Transaction ID',
  ];

  const rows = items.map((item) => {
    const date = new Date(item.createdAt);
    const datePart = Number.isNaN(date.getTime())
      ? item.createdAt
      : date.toISOString().slice(0, 10);
    const timePart = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleTimeString('en-GB', { hour12: false });
    const amount = parseAmount(item.amount);
    const signed =
      item.type === 'credit' ? Math.abs(amount) : -Math.abs(amount);

    return [
      datePart,
      timePart,
      csvEscape(item.title),
      csvEscape(item.subtitle),
      csvEscape(categoryLabel(item.category)),
      item.type,
      statusDisplayLabel(item.status),
      signed.toFixed(2),
      (item.currency ?? opts.currency ?? 'NGN').toUpperCase(),
      item.id,
    ].join(',');
  });

  const summary = summarizeCashflow(items);
  const meta = [
    `# ORYNO Wallet Statement`,
    `# Period: ${opts.periodLabel}`,
    `# Generated: ${new Date().toISOString()}`,
    `# In: ${summary.inflow.toFixed(2)}`,
    `# Out: ${summary.outflow.toFixed(2)}`,
    `# Count: ${summary.count}`,
    '',
  ];

  return [...meta, header.join(','), ...rows].join('\n');
}

function csvEscape(value: string) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function statusDisplayLabel(status: string) {
  const normalized = normalizeStatusLabel(status);
  if (normalized === 'Completed') return 'Successful';
  return normalized;
}
