"use client";

import { getCountryInfo } from "@/lib/country";
import { cn } from "@/lib/utils";

type Props = {
  balance: string | number;
  currency?: string;
  countryCode?: string | null;
  hidden?: boolean;
  className?: string;
  symbolClassName?: string;
  amountClassName?: string;
};

function formatAmountDigits(
  amount: string | number,
  locale: string,
) {
  const value = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(value)
    ? Math.abs(value).toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
}

export function WalletBalanceAmount({
  balance,
  currency,
  countryCode,
  hidden,
  className,
  symbolClassName,
  amountClassName,
}: Props) {
  if (hidden) {
    return <span className={className}>••••••••</span>;
  }

  const info = getCountryInfo(countryCode);
  const symbol =
    currency?.toUpperCase() === "USD"
      ? "$"
      : currency && currency.toUpperCase() !== info.currency
        ? currency
        : info.currencySymbol;
  const locale =
    currency?.toUpperCase() === "USD" ? "en-US" : info.locale;

  return (
    <span className={cn("inline-flex items-baseline ", className)}>
      <span className={cn("shrink-0", symbolClassName)}>{symbol}</span>
      <span className={amountClassName}>
        {formatAmountDigits(balance, locale)}
      </span>
    </span>
  );
}
