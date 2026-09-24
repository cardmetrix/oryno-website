"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Plus,
  Snowflake,
  Trash2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { TransactionPinModal } from "@/components/app/transaction-pin-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";

type VirtualCard = {
  id: string;
  brand: string;
  label: string;
  last4: string;
  expMonth: number;
  expYear: number;
  expLabel: string;
  status: "active" | "frozen" | "terminated";
  provider: string;
  maskedNumber: string;
  createdAt: string;
};

type CardsPayload = {
  issuer: string;
  issueFeeUsd: number;
  issueFeeFormatted: string;
  maxActiveCards: number;
  holderName: string;
  usd: {
    id: string;
    balance: string;
    balanceFormatted: string;
    status: string;
  };
  cards: VirtualCard[];
};

type Revealed = {
  panFormatted: string;
  cvv: string;
  expLabel: string;
  holderName?: string;
};

export default function CardsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <PageHeader
            title="Cards"
            subtitle="USD virtual cards"
            backHref="/dashboard"
          />
          <Skeleton className="mt-4 h-52 w-full rounded-[22px]" />
        </AppShell>
      }
    >
      <CardsPageContent />
    </Suspense>
  );
}

function CardsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch: refetchWallet } = useWallet();
  const [data, setData] = useState<CardsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);
  const [funding, setFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState("20");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/cards", { cache: "no-store" });
      const json = (await res.json()) as CardsPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load cards");
      setData(json);
      setSelectedId((prev) => {
        if (prev && json.cards.some((c) => c.id === prev)) return prev;
        return json.cards[0]?.id ?? null;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load cards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // USD fund callback: /cards?usd_fund=1&tx_ref=...
  useEffect(() => {
    const usdFund = searchParams.get("usd_fund");
    const reference =
      searchParams.get("tx_ref") ||
      searchParams.get("reference") ||
      searchParams.get("trxref");
    const transactionId =
      searchParams.get("transaction_id") || searchParams.get("transactionId");
    if (!usdFund || (!reference && !transactionId)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wallet/usd/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, transactionId }),
        });
        const json = (await res.json()) as {
          error?: string;
          amountFormatted?: string;
        };
        if (!res.ok) throw new Error(json.error || "Could not verify payment");
        if (cancelled) return;
        toast.success("USD wallet funded", {
          description: json.amountFormatted,
        });
        await load();
        await refetchWallet();
        router.replace("/cards");
      } catch (err) {
        if (cancelled) return;
        toast.error(
          err instanceof Error ? err.message : "USD payment verification failed",
        );
        router.replace("/cards");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, load, refetchWallet, router]);

  const selected =
    data?.cards.find((c) => c.id === selectedId) ?? data?.cards[0] ?? null;

  async function onIssue() {
    setIssuing(true);
    try {
      const res = await fetch("/api/wallet/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        error?: string;
        card?: VirtualCard;
        feeFormatted?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not issue card");
      toast.success("USD card issued", {
        description: json.feeFormatted
          ? `Fee ${json.feeFormatted}`
          : undefined,
      });
      setRevealed(null);
      setHidden(true);
      await load();
      await refetchWallet();
      if (json.card) setSelectedId(json.card.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not issue card");
    } finally {
      setIssuing(false);
    }
  }

  async function onRevealPin(pin: string) {
    if (!selected) return;
    setPinLoading(true);
    setPinError(null);
    try {
      const res = await fetch(`/api/wallet/cards/${selected.id}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = (await res.json()) as Revealed & {
        error?: string;
        code?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not reveal card");
      setRevealed({
        panFormatted: json.panFormatted,
        cvv: json.cvv,
        expLabel: json.expLabel,
        holderName: json.holderName,
      });
      setHidden(false);
      setPinOpen(false);
      toast.success("Card details unlocked");
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Reveal failed");
    } finally {
      setPinLoading(false);
    }
  }

  async function onStatus(status: "active" | "frozen" | "terminated") {
    if (!selected) return;
    setBusyStatus(true);
    try {
      const res = await fetch(`/api/wallet/cards/${selected.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as {
        error?: string;
        card?: VirtualCard;
      };
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast.success(
        status === "frozen"
          ? "Card frozen"
          : status === "terminated"
            ? "Card terminated"
            : "Card unfrozen",
      );
      setRevealed(null);
      setHidden(true);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyStatus(false);
    }
  }

  async function onFundUsd() {
    const amount = Number(fundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid USD amount");
      return;
    }
    setFunding(true);
    try {
      const callbackUrl = `${window.location.origin}/cards?usd_fund=1`;
      const res = await fetch("/api/wallet/usd/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: amount,
          method: "checkout",
          callbackUrl,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        authorizationUrl?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not start funding");
      if (!json.authorizationUrl) throw new Error("Payment page unavailable");
      window.location.href = json.authorizationUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Funding failed");
      setFunding(false);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ""));
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }

  const displayNumber =
    !hidden && revealed
      ? revealed.panFormatted
      : selected?.maskedNumber ?? "•••• •••• •••• ••••";
  const displayExp =
    !hidden && revealed ? revealed.expLabel : selected?.expLabel ?? "••/••";
  const displayCvv = !hidden && revealed ? revealed.cvv : "•••";
  const holder =
    revealed?.holderName || data?.holderName || "ORYNO USER";

  return (
    <AppShell>
      <PageHeader
        title="Cards"
        subtitle="USD virtual cards for online payments"
        backHref="/dashboard"
      />

      {loading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-[22px]" />
          <Skeleton className="h-32 w-full rounded-[22px]" />
        </div>
      ) : (
        <>
          <MotionSection className="mb-4">
            <div className="usd-card-surface isolate overflow-hidden rounded-[22px] ring-1 ring-[color:var(--usd-card-ring)]">
              <motion.div
                aria-hidden
                animate={{ x: ["-40%", "140%"] }}
                transition={{
                  duration: 5.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 2,
                }}
                className="pointer-events-none absolute inset-y-0 z-[1] w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-[color:var(--usd-card-sheen)] to-transparent"
              />

              <div className="relative z-[2] flex flex-col gap-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-90">
                    ORYNO
                  </p>
                  <span className="usd-card-chip rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wide">
                    USD WALLET
                  </span>
                </div>

                <p className="text-sm font-semibold tracking-wide sm:text-[15px]">
                  USD Wallet 🌐
                </p>

                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-[10px] font-medium tracking-[0.14em] uppercase"
                      style={{ color: "var(--usd-card-soft)" }}
                    >
                      Available balance
                    </p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={balanceHidden ? "h" : data.usd.balanceFormatted}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="mt-0.5 truncate text-2xl font-bold tracking-tight sm:text-3xl"
                      >
                        {balanceHidden ? "••••••••" : data.usd.balanceFormatted}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setBalanceHidden((v) => !v)}
                    className="usd-card-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    aria-label={balanceHidden ? "Show balance" : "Hide balance"}
                  >
                    {balanceHidden ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </motion.button>
                </div>

                <p
                  className="text-[12px] leading-snug"
                  style={{ color: "var(--usd-card-muted)" }}
                >
                  Use your USD balance for gift cards, international virtual
                  numbers and more.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="usd-card-btn inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold"
                    onClick={() =>
                      document
                        .getElementById("fund-usd")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Fund Wallet
                  </button>
                  <Link
                    href="/convert"
                    className="usd-card-btn-alt inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Convert
                  </Link>
                </div>
              </div>
            </div>
          </MotionSection>

          {/* Virtual card */}
          <MotionSection delay={0.04} className="mb-4">
            <div className="usd-card-surface isolate overflow-hidden rounded-[22px] ring-1 ring-[color:var(--usd-card-ring)]">
              <motion.div
                aria-hidden
                animate={{ x: ["-40%", "140%"] }}
                transition={{
                  duration: 5.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 2,
                }}
                className="pointer-events-none absolute inset-y-0 z-[1] w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-[color:var(--usd-card-sheen)] to-transparent"
              />

              <div className="relative z-[2] space-y-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-[11px] font-bold tracking-[0.2em] uppercase"
                      style={{ color: "var(--usd-card-soft)" }}
                    >
                      ORYNO · {data.issuer.toUpperCase()}
                    </p>
                    <p className="mt-1 text-sm font-semibold opacity-95">
                      {selected?.label ?? "USD Virtual Card"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
                          selected.status === "active"
                            ? "bg-emerald-500/20 text-emerald-200"
                            : selected.status === "frozen"
                              ? "bg-sky-500/20 text-sky-200"
                              : "usd-card-chip",
                        )}
                      >
                        {selected.status}
                      </span>
                    ) : null}
                    <span className="usd-card-chip rounded-md px-2 py-1 text-[10px] font-bold tracking-wide">
                      VISA
                    </span>
                  </div>
                </div>

                <div className="flex h-8 w-11 items-center justify-center rounded-md bg-gradient-to-br from-amber-200/90 to-amber-500/80">
                  <div className="h-5 w-7 rounded-[3px] bg-amber-100/40 ring-1 ring-amber-900/20" />
                </div>

                <div className="flex items-end justify-between gap-3">
                  <p className="font-mono text-xl tracking-[0.12em] sm:text-2xl">
                    {displayNumber}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (hidden) {
                        setPinError(null);
                        setPinOpen(true);
                      } else {
                        setHidden(true);
                        setRevealed(null);
                      }
                    }}
                    disabled={!selected}
                    className="usd-card-chip flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
                    aria-label={hidden ? "Reveal card" : "Hide card"}
                  >
                    {hidden ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p
                      className="text-[10px] tracking-wide uppercase"
                      style={{ color: "var(--usd-card-soft)" }}
                    >
                      Cardholder
                    </p>
                    <p className="text-sm font-semibold tracking-wide uppercase">
                      {holder}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[10px] tracking-wide uppercase"
                      style={{ color: "var(--usd-card-soft)" }}
                    >
                      Exp
                    </p>
                    <p className="font-mono text-sm font-semibold">{displayExp}</p>
                  </div>
                  <div>
                    <p
                      className="text-[10px] tracking-wide uppercase"
                      style={{ color: "var(--usd-card-soft)" }}
                    >
                      CVV
                    </p>
                    <p className="font-mono text-sm font-semibold">{displayCvv}</p>
                  </div>
                </div>
              </div>
            </div>
          </MotionSection>

          {data.cards.length > 1 ? (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {data.cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(card.id);
                    setRevealed(null);
                    setHidden(true);
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
                    selected?.id === card.id
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  •••• {card.last4}
                </button>
              ))}
            </div>
          ) : null}

          {/* Actions */}
          <MotionSection
            delay={0.08}
            className="mb-4 rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
          >
            {selected ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ActionBtn
                  icon={Copy}
                  label="Copy number"
                  disabled={hidden || !revealed}
                  onClick={() =>
                    revealed &&
                    void copyText(revealed.panFormatted, "Card number")
                  }
                />
                <ActionBtn
                  icon={selected.status === "frozen" ? Unlock : Snowflake}
                  label={selected.status === "frozen" ? "Unfreeze" : "Freeze"}
                  disabled={busyStatus || selected.status === "terminated"}
                  onClick={() =>
                    void onStatus(
                      selected.status === "frozen" ? "active" : "frozen",
                    )
                  }
                />
                <ActionBtn
                  icon={Lock}
                  label="Reveal"
                  disabled={selected.status === "terminated"}
                  onClick={() => {
                    setPinError(null);
                    setPinOpen(true);
                  }}
                />
                <ActionBtn
                  icon={Trash2}
                  label="Terminate"
                  danger
                  disabled={busyStatus}
                  onClick={() => void onStatus("terminated")}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No USD virtual card yet. Issue one to pay online worldwide —
                spends from your USD wallet balance.
              </p>
            )}

            <button
              type="button"
              disabled={issuing || data.cards.length >= data.maxActiveCards}
              onClick={() => void onIssue()}
              className="btn-primary mt-4 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50"
            >
              {issuing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              )}
              {data.cards.length === 0
                ? `Issue USD card · ${data.issueFeeFormatted}`
                : `Issue another · ${data.issueFeeFormatted}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Fee is charged from your USD wallet. Max {data.maxActiveCards}{" "}
              active cards.
            </p>
          </MotionSection>

          {/* Fund USD */}
          <div id="fund-usd" className="scroll-mt-24">
          <MotionSection
            delay={0.12}
            className="rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
          >
            <div className="mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Fund USD wallet
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {["10", "20", "50", "100"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFundAmount(p)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                    fundAmount === p
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-muted text-muted-foreground ring-border",
                  )}
                >
                  ${p}
                </button>
              ))}
            </div>
            <input
              inputMode="decimal"
              value={fundAmount}
              onChange={(e) =>
                setFundAmount(e.target.value.replace(/[^\d.]/g, ""))
              }
              className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
              placeholder="Amount USD"
            />
            <button
              type="button"
              disabled={funding}
              onClick={() => void onFundUsd()}
              className="btn-primary mt-3 inline-flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {funding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Pay with card / mobile money
            </button>
          </MotionSection>
          </div>
        </>
      )}

      <TransactionPinModal
        open={pinOpen}
        mode="confirm"
        title="Confirm to reveal card"
        description="Enter your transaction PIN to view the full card number and CVV."
        confirmLabel="Reveal card"
        loading={pinLoading}
        error={pinError}
        onOpenChange={setPinOpen}
        onConfirm={({ pin }) => void onRevealPin(pin)}
      />
    </AppShell>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-muted/30 px-2 py-3 text-center disabled:opacity-40",
        danger && "border-destructive/30 text-destructive",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-semibold">{label}</span>
    </motion.button>
  );
}
