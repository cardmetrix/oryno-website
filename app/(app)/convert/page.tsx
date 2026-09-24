"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";

type FxQuote = {
  midRate: number;
  buyRate: number;
  sellRate: number;
  commissionPercent: number;
  provider: string;
};

export default function ConvertPage() {
  return (
    <Suspense
      fallback={
        <AppShell hideNav>
          <PageHeader title="Convert" subtitle="Local ↔ USD" backHref="/dashboard" />
          <Skeleton className="mt-4 h-48 w-full rounded-[22px]" />
        </AppShell>
      }
    >
      <ConvertPageContent />
    </Suspense>
  );
}

function ConvertPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: wallet, refetch } = useWallet();
  const localCurrency = wallet?.primary.currency ?? "NGN";
  const localBalance = Number(wallet?.primary.balance ?? 0);
  const usdBalance = Number(wallet?.usd?.balance ?? 0);

  const [direction, setDirection] = useState<"to_usd" | "to_local">(
    searchParams.get("direction") === "to_local" ? "to_local" : "to_usd",
  );
  const [amount, setAmount] = useState(
    direction === "to_usd" ? "1000" : "10",
  );
  const [fx, setFx] = useState<FxQuote | null>(wallet?.fx ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/wallet/fx?currency=${encodeURIComponent(localCurrency)}&direction=${direction}&amount=${encodeURIComponent(amount || "0")}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { quote?: FxQuote };
        if (!cancelled && json.quote) setFx(json.quote);
      } catch {
        // keep existing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localCurrency, direction, amount]);

  const preview = useMemo(() => {
    const n = Number(amount);
    if (!fx || !Number.isFinite(n) || n <= 0) return null;
    if (direction === "to_usd") {
      const usd = n / fx.buyRate;
      const feePct = fx.commissionPercent ?? 0;
      return {
        fromAmount: n,
        fromCurrency: localCurrency,
        toAmount: usd,
        toCurrency: "USD",
        rate: fx.buyRate,
        feeLabel: feePct > 0 ? `${(feePct * 100).toFixed(2)}%` : "Included in rate",
        resultingLocal: Math.max(0, localBalance - n),
        resultingUsd: usdBalance + usd,
      };
    }
    const local = n * fx.sellRate;
    return {
      fromAmount: n,
      fromCurrency: "USD",
      toAmount: local,
      toCurrency: localCurrency,
      rate: fx.sellRate,
      feeLabel:
        (fx.commissionPercent ?? 0) > 0
          ? `${((fx.commissionPercent ?? 0) * 100).toFixed(2)}%`
          : "Included in rate",
      resultingLocal: localBalance + local,
      resultingUsd: Math.max(0, usdBalance - n),
    };
  }, [amount, direction, fx, localBalance, localCurrency, usdBalance]);

  const insufficient =
    direction === "to_usd"
      ? Number(amount) > localBalance
      : Number(amount) > usdBalance;

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (!preview || insufficient) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          amount: Number(amount),
          localCurrency,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        creditTransactionId?: string;
        toAmount?: number;
        toCurrency?: string;
      };
      if (!res.ok) throw new Error(json.error || "Conversion failed");
      toast.success("Converted successfully");
      await refetch();
      if (json.creditTransactionId) {
        router.replace(`/history/${json.creditTransactionId}`);
      } else {
        router.replace("/wallet");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Convert"
        subtitle={`${localCurrency} ↔ USD`}
        backHref="/dashboard"
      />

      <MotionSection className="mb-4 rounded-[18px] border border-border bg-muted/40 px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <span className="text-muted-foreground">{localCurrency}</span>{" "}
            <span className="font-bold">
              {wallet?.primary.balanceFormatted ?? "—"}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">USD</span>{" "}
            <span className="font-bold">
              {wallet?.usd?.balanceFormatted ?? "$0.00"}
            </span>
          </span>
        </div>
      </MotionSection>

      <MotionSection
        delay={0.04}
        className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-1">
          {(
            [
              ["to_usd", `${localCurrency} → USD`],
              ["to_local", `USD → ${localCurrency}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setDirection(value);
                setConfirming(false);
                setAmount(value === "to_usd" ? "1000" : "10");
              }}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                direction === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">
            Amount ({direction === "to_usd" ? localCurrency : "USD"})
          </span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d.]/g, ""));
              setConfirming(false);
            }}
            className="h-12 w-full rounded-xl border border-border bg-background px-3 text-base font-semibold outline-none focus:border-primary"
          />
        </label>

        {preview ? (
          <div className="mt-4 space-y-2 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            <Row
              label="You send"
              value={`${preview.fromCurrency} ${preview.fromAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Row
              label="Exchange rate"
              value={`1 USD ≈ ${preview.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${localCurrency}`}
            />
            <Row label="Conversion fee" value={preview.feeLabel} />
            <Row
              label="You receive"
              value={`${preview.toCurrency} ${preview.toAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              emphasize
            />
            <div className="border-t border-border pt-2" />
            <Row
              label={`Resulting ${localCurrency}`}
              value={preview.resultingLocal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            />
            <Row
              label="Resulting USD"
              value={preview.resultingUsd.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            />
          </div>
        ) : null}

        {insufficient ? (
          <p className="mt-3 text-sm font-medium text-destructive">
            Insufficient {direction === "to_usd" ? localCurrency : "USD"} balance
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
        ) : null}

        {!confirming ? (
          <button
            type="button"
            disabled={!preview || insufficient}
            onClick={() => setConfirming(true)}
            className="btn-primary mt-5 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Review conversion
          </button>
        ) : (
          <form onSubmit={(e) => void onConfirm(e)} className="mt-5 space-y-3">
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              Confirm the amounts above. This moves funds between your local and
              USD wallets instantly.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-12 rounded-xl border border-border text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn-primary inline-flex h-12 items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm convert
              </button>
            </div>
          </form>
        )}
      </MotionSection>
    </AppShell>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-semibold",
          emphasize && "text-oryno-orange",
        )}
      >
        {value}
      </span>
    </div>
  );
}
