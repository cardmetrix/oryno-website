"use client";

import { useCallback, useEffect, useState } from "react";

export function useWalletBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [ngnBalance, setNgnBalance] = useState<number | null>(null);
  const [usdBalance, setUsdBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState("NGN");
  const [status, setStatus] = useState<"healthy" | "frozen" | "closed" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        primary?: { balance?: string; currency?: string; status?: string };
        usd?: { balance?: string } | null;
        totals?: { usdBalance?: string };
        ledgerNgn?: string;
      };
      setBalance(Number(json.primary?.balance ?? 0));
      setNgnBalance(
        json.ledgerNgn != null
          ? Number(json.ledgerNgn)
          : Number(json.primary?.balance ?? 0),
      );
      setUsdBalance(
        Number(json.usd?.balance ?? json.totals?.usdBalance ?? 0),
      );
      setCurrency(json.primary?.currency ?? "NGN");
      const nextStatus = json.primary?.status;
      setStatus(
        nextStatus === "frozen" || nextStatus === "closed" || nextStatus === "healthy"
          ? nextStatus
          : "healthy",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

    const walletReady = !loading && status !== "frozen" && status !== "closed";

  const canAfford = useCallback(
    (amount: number) => {
      if (loading || balance == null || !walletReady) return false;
      if (!Number.isFinite(amount) || amount <= 0) return true;
      return amount <= balance + 0.0001;
    },
    [loading, walletReady, balance],
  );

  const canAffordUsd = useCallback(
    (amount: number) => {
      if (loading || usdBalance == null || !walletReady) return false;
      if (!Number.isFinite(amount) || amount <= 0) return true;
      return amount <= usdBalance + 0.0001;
    },
    [loading, walletReady, usdBalance],
  );

  const canAffordNgn = useCallback(
    (amount: number) => {
      if (loading || ngnBalance == null || !walletReady) return false;
      if (!Number.isFinite(amount) || amount <= 0) return true;
      return amount <= ngnBalance + 0.0001;
    },
    [loading, walletReady, ngnBalance],
  );

  return {
    balance,
    ngnBalance,
    usdBalance,
    currency,
    status,
    loading,
    frozen: status === "frozen" || status === "closed",
    refresh,
    canAfford,
    canAffordUsd,
    canAffordNgn,
  };
}
