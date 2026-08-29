"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { WalletSummary } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

export type UsdPanel = "fund" | "convert";

type FxQuote = {
  midRate: number;
  buyRate: number;
  sellRate: number;
  commissionPercent: number;
  provider: string;
  quote: string;
};

type CardProps = {
  usd: WalletSummary | null | undefined;
  hidden?: boolean;
  holderName?: string;
  panel: UsdPanel;
  onPanelChange: (panel: UsdPanel) => void;
  className?: string;
};

type ActionsProps = {
  localCurrency: string;
  localBalanceFormatted: string;
  fx?: FxQuote | null;
  panel: UsdPanel;
  onPanelChange: (panel: UsdPanel) => void;
  onUpdated?: () => void;
  className?: string;
};

const USD_PRESETS = ["5", "10", "20", "50", "100"];

/** Dark USD balance card with Fund / Convert toggles (matches mobile). */
export function UsdWalletCard({
  usd,
  hidden,
  holderName,
  panel,
  onPanelChange,
  className,
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative flex h-full min-h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#1C1C1E] shadow-[0_18px_40px_rgba(0,0,0,0.28)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,106,0,0.22),transparent_45%),radial-gradient(circle_at_10%_90%,rgba(255,255,255,0.06),transparent_40%)]" />
      <motion.div
        aria-hidden="true"
        animate={{ x: ["-35%", "135%"] }}
        transition={{
          duration: 5.2,
          repeat: Infinity,
          ease: "easeInOut",
          repeatDelay: 2.4,
        }}
        className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />

      <div className="relative flex flex-1 flex-col px-5 py-5 text-white sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-white/65 uppercase">
              USD Wallet
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={hidden ? "h" : usd?.balanceFormatted ?? "0"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
              >
                {hidden ? "••••••••" : (usd?.balanceFormatted ?? "$0.00")}
              </motion.p>
            </AnimatePresence>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90 ring-1 ring-white/15">
            <ShieldCheck className="h-3.5 w-3.5 text-oryno-orange" />
            Protected
          </span>
        </div>

        <p className="mt-1.5 text-sm text-white/70">
        USD Wallet
        </p>

        <div className="relative mt-5 grid grid-cols-2 gap-2.5 md:mt-auto md:pt-5">
          <button
            type="button"
            onClick={() => onPanelChange("fund")}
            className={cn(
              "flex h-[50px] items-center justify-center gap-2 rounded-[16px] text-sm font-bold transition",
              panel === "fund"
                ? "bg-oryno-orange text-black"
                : "bg-white text-black",
            )}
          >
            <Plus className="h-4 w-4 text-black" strokeWidth={2.5} />
            Fund
          </button>
          <button
            type="button"
            onClick={() => onPanelChange("convert")}
            className={cn(
              "flex h-[50px] items-center justify-center gap-2 rounded-[16px] text-sm font-bold ring-1 transition",
              panel === "convert"
                ? "bg-oryno-orange text-black ring-transparent"
                : "bg-white/10 text-white ring-white/15",
            )}
          >
            <ArrowLeftRight className="h-4 w-4" strokeWidth={2.25} />
            Convert
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/** Fund / Convert form shown under the USD card (matches mobile UsdWalletActionsPanel). */
export function UsdWalletActionsPanel({
  localCurrency,
  localBalanceFormatted,
  fx,
  panel,
  onPanelChange,
  onUpdated,
  className,
}: ActionsProps) {
  const router = useRouter();
  const [fundMethod, setFundMethod] = useState<"paystack" | "convert">(
    "paystack",
  );
  const [direction, setDirection] = useState<"to_usd" | "to_local">("to_usd");
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveFx, setLiveFx] = useState<FxQuote | null>(fx ?? null);

  useEffect(() => {
    setLiveFx(fx ?? null);
  }, [fx]);

  useEffect(() => {
    if (panel === "fund") setFundMethod("paystack");
    setError(null);
  }, [panel]);

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
        if (!cancelled && json.quote) setLiveFx(json.quote);
      } catch {
        // keep existing quote
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localCurrency, direction, amount, panel]);

  const preview = useMemo(() => {
    if (!liveFx || !amount || Number(amount) <= 0) return null;
    const n = Number(amount);
    if (panel === "fund" || (panel === "convert" && direction === "to_usd")) {
      const localCost = n * liveFx.buyRate;
      return {
        label: `You pay · ${localCurrency}`,
        value: localCost.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        receive: `You get · $${n.toFixed(2)}`,
      };
    }
    if (panel === "convert" && direction === "to_local") {
      const localGets = n * liveFx.sellRate;
      return {
        label: `You send · USD`,
        value: n.toFixed(2),
        receive: `You get · ${localCurrency} ${localGets.toLocaleString("en-NG", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
      };
    }
    return null;
  }, [liveFx, amount, panel, direction, localCurrency]);

  async function onFund() {
    setBusy(true);
    setError(null);
    try {
      const callbackUrl = `${window.location.origin}/wallet?usd_fund=1`;
      const res = await fetch("/api/wallet/usd/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: amount,
          method: fundMethod,
          callbackUrl,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        authorizationUrl?: string;
        transactionId?: string;
        usdFormatted?: string;
      };
      if (!res.ok) throw new Error(json.error || "Funding failed");

      if (json.authorizationUrl) {
        window.location.href = json.authorizationUrl;
        return;
      }

      toast.success("USD wallet funded", {
        description: json.usdFormatted ?? `$${amount} credited`,
      });
      onPanelChange("fund");
      onUpdated?.();
      if (json.transactionId) router.push(`/history/${json.transactionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Funding failed");
    } finally {
      setBusy(false);
    }
  }

  async function onConvert() {
    setBusy(true);
    setError(null);
    try {
      if (direction === "to_usd") {
        const res = await fetch("/api/wallet/usd/fund", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountUsd: amount, method: "convert" }),
        });
        const json = (await res.json()) as {
          error?: string;
          transactionId?: string;
          toFormatted?: string;
        };
        if (!res.ok) throw new Error(json.error || "Conversion failed");
        toast.success("Converted to USD", { description: json.toFormatted });
        onPanelChange("fund");
        onUpdated?.();
        if (json.transactionId) router.push(`/history/${json.transactionId}`);
        return;
      }

      const res = await fetch("/api/wallet/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "to_local", amount }),
      });
      const json = (await res.json()) as {
        error?: string;
        transactionId?: string;
        toFormatted?: string;
      };
      if (!res.ok) throw new Error(json.error || "Conversion failed");
      toast.success("Converted to local", { description: json.toFormatted });
      onPanelChange("fund");
      onUpdated?.();
      if (json.transactionId) router.push(`/history/${json.transactionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("mt-3 h-full", className)}>
      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={panel}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="h-full"
      >
        <div className="flex h-full flex-col rounded-[22px] bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
          {panel === "fund" ? (
            <>
              <h3 className="text-sm font-semibold text-foreground">
                Fund USD wallet
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Pay with Paystack (local currency) or convert from your{" "}
                {localCurrency} balance ({localBalanceFormatted}).
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFundMethod("paystack")}
                  className={cn(
                    "rounded-[14px] border px-3 py-2.5 text-xs font-semibold",
                    fundMethod === "paystack"
                      ? "border-primary bg-oryno-orange-muted text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  Paystack
                </button>
                <button
                  type="button"
                  onClick={() => setFundMethod("convert")}
                  className={cn(
                    "rounded-[14px] border px-3 py-2.5 text-xs font-semibold",
                    fundMethod === "convert"
                      ? "border-primary bg-oryno-orange-muted text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  From {localCurrency}
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-foreground">
                Convert currencies
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Live open-market rate + 1% ORYNO commission.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("to_usd")}
                  className={cn(
                    "rounded-[14px] border px-3 py-2.5 text-xs font-semibold",
                    direction === "to_usd"
                      ? "border-primary bg-oryno-orange-muted text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {localCurrency} → USD
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("to_local")}
                  className={cn(
                    "rounded-[14px] border px-3 py-2.5 text-xs font-semibold",
                    direction === "to_local"
                      ? "border-primary bg-oryno-orange-muted text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  USD → {localCurrency}
                </button>
              </div>
            </>
          )}

          <label className="mt-4 block">
            <span className="text-sm font-medium text-foreground">
              USD amount
            </span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value
                    .replace(/[^\d.]/g, "")
                    .replace(/(\..*)\./g, "$1"),
                )
              }
              className="mt-2 h-12 w-full rounded-[14px] border border-border bg-muted/40 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {USD_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  amount === preset
                    ? "bg-oryno-charcoal text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                ${preset}
              </button>
            ))}
          </div>

          {preview ? (
            <div className="mt-4 rounded-[16px] bg-muted/50 px-4 py-3 text-sm">
              <p className="text-muted-foreground">{preview.label}</p>
              <p className="mt-0.5 font-bold text-foreground">{preview.value}</p>
              <p className="mt-2 text-xs font-semibold text-primary">
                {preview.receive}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
          ) : null}

          <div className="mt-auto pt-4">
          <button
            type="button"
            disabled={busy || !amount || Number(amount) <= 0}
            onClick={() => void (panel === "fund" ? onFund() : onConvert())}
            className="btn-primary inline-flex h-12 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : panel === "fund" ? (
              fundMethod === "paystack" ? (
                "Pay with Paystack"
              ) : (
                `Convert from ${localCurrency}`
              )
            ) : direction === "to_usd" ? (
              "Convert to USD"
            ) : (
              `Convert to ${localCurrency}`
            )}
          </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
    </div>
  );
}
