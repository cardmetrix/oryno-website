"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
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

type PendingOrder = {
  id: string;
  status:
    | "pending_payment"
    | "paid_pending_review"
    | "approved"
    | "rejected"
    | "issued";
  feeFormatted: string;
  localFormatted: string;
  localCurrency: string;
};

type CardsPayload = {
  issuer: string;
  issueFeeUsd: number;
  issueFeeFormatted: string;
  maxActiveCards: number;
  holderName: string;
  pendingOrder: PendingOrder | null;
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
  const [data, setData] = useState<CardsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState(true);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);

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

  // Flutterwave return: /cards?card_purchase=1&tx_ref=...
  useEffect(() => {
    const cardPurchase = searchParams.get("card_purchase");
    const reference =
      searchParams.get("tx_ref") ||
      searchParams.get("reference") ||
      searchParams.get("trxref");
    const transactionId =
      searchParams.get("transaction_id") || searchParams.get("transactionId");
    if (!cardPurchase || (!reference && !transactionId)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wallet/cards/purchase/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, transactionId }),
        });
        const json = (await res.json()) as {
          error?: string;
          order?: PendingOrder;
        };
        if (!res.ok) throw new Error(json.error || "Could not verify payment");
        if (cancelled) return;
        toast.success("Payment received", {
          description: "Your card purchase is awaiting admin review.",
        });
        await load();
        router.replace("/cards");
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Could not verify payment",
          );
          router.replace("/cards");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, load, router]);

  async function onPurchase() {
    setPurchasing(true);
    try {
      const callbackUrl = `${window.location.origin}/cards?card_purchase=1`;
      const res = await fetch("/api/wallet/cards/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callbackUrl }),
      });
      const json = (await res.json()) as {
        error?: string;
        authorizationUrl?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not start purchase");
      if (!json.authorizationUrl) throw new Error("Payment page unavailable");
      window.location.href = json.authorizationUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
      setPurchasing(false);
    }
  }

  async function onRevealPin(pin: string) {
    if (!selectedId) return;
    setPinLoading(true);
    setPinError(null);
    try {
      const res = await fetch(`/api/wallet/cards/${selectedId}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = (await res.json()) as Revealed & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not reveal card");
      setRevealed({
        panFormatted: json.panFormatted,
        cvv: json.cvv,
        expLabel: json.expLabel,
        holderName: json.holderName,
      });
      setHidden(false);
      setPinOpen(false);
      toast.success("Card details revealed");
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Invalid PIN");
    } finally {
      setPinLoading(false);
    }
  }

  async function onStatus(status: "active" | "frozen" | "terminated") {
    if (!selectedId) return;
    setBusyStatus(true);
    try {
      const res = await fetch(`/api/wallet/cards/${selectedId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not update card");
      toast.success(
        status === "frozen"
          ? "Card frozen"
          : status === "active"
            ? "Card unfrozen"
            : "Card terminated",
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

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value.replace(/\s/g, ""));
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }

  const selected =
    data?.cards.find((c) => c.id === selectedId) ?? data?.cards[0] ?? null;

  const displayNumber =
    !hidden && revealed
      ? revealed.panFormatted
      : (selected?.maskedNumber ?? "???? ???? ???? ????");
  const displayExp =
    !hidden && revealed ? revealed.expLabel : (selected?.expLabel ?? "??/??");
  const displayCvv = !hidden && revealed ? revealed.cvv : "???";
  const holder = revealed?.holderName || data?.holderName || "ORYNO USER";

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
          {!selected ? (
            <MotionSection className="mb-4">
              <div className="usd-card-surface isolate overflow-hidden rounded-[22px] ring-1 ring-[color:var(--usd-card-ring)]">
                <div className="relative z-[2] flex flex-col gap-4 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-90">
                      ORYNO
                    </p>
                    <span className="usd-card-chip rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wide">
                      USD VIRTUAL CARD
                    </span>
                  </div>

                  <div>
                    <p className="text-xl font-bold tracking-tight sm:text-2xl">
                      Purchase a USD virtual card
                    </p>
                    <p
                      className="mt-2 text-sm leading-relaxed"
                      style={{ color: "var(--usd-card-muted)" }}
                    >
                      Pay {data.issueFeeFormatted} via Flutterwave. After
                      payment, our team reviews your request and issues your
                      Visa card for online payments worldwide.
                    </p>
                  </div>

                  {data.pendingOrder?.status === "paid_pending_review" ? (
                    <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                      <p className="text-sm font-semibold">Under review</p>
                      <p
                        className="mt-1 text-xs"
                        style={{ color: "var(--usd-card-muted)" }}
                      >
                        Payment of {data.pendingOrder.localFormatted} received.
                        You?ll get a notification when your card is issued.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={purchasing}
                      onClick={() => void onPurchase()}
                      className="usd-card-btn inline-flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold disabled:opacity-50"
                    >
                      {purchasing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Purchase card · {data.issueFeeFormatted}
                    </button>
                  )}
                </div>
              </div>
            </MotionSection>
          ) : null}

          {selected ? (
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
                        {selected.label ?? "USD Virtual Card"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                      className="rounded-full bg-white/10 p-2 ring-1 ring-white/15"
                      aria-label={hidden ? "Reveal card" : "Hide card"}
                    >
                      {hidden ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
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
                      <p className="font-mono text-sm font-semibold">
                        {displayExp}
                      </p>
                    </div>
                    <div>
                      <p
                        className="text-[10px] tracking-wide uppercase"
                        style={{ color: "var(--usd-card-soft)" }}
                      >
                        CVV
                      </p>
                      <p className="font-mono text-sm font-semibold">
                        {displayCvv}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </MotionSection>
          ) : null}

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
                  ???? {card.last4}
                </button>
              ))}
            </div>
          ) : null}

          {selected ? (
            <MotionSection
              delay={0.08}
              className="mb-4 rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
            >
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

              {data.cards.length < data.maxActiveCards ? (
                <>
                  <button
                    type="button"
                    disabled={
                      purchasing ||
                      data.pendingOrder?.status === "paid_pending_review"
                    }
                    onClick={() => void onPurchase()}
                    className="btn-primary mt-4 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-50"
                  >
                    {purchasing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                    )}
                    Purchase another · {data.issueFeeFormatted}
                  </button>
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    Pay with Flutterwave. Max {data.maxActiveCards} active
                    cards.
                  </p>
                </>
              ) : null}

              {data.pendingOrder?.status === "paid_pending_review" ? (
                <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-center text-xs text-muted-foreground">
                  A purchase is under review ({data.pendingOrder.localFormatted}
                  ).
                </p>
              ) : null}
            </MotionSection>
          ) : null}
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
