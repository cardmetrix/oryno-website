"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Loader2,
  MessageSquareText,
  Phone,
  RefreshCw,
  RotateCcw,
  Share2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { BRAND_LOGO_SRC, BrandLogo } from "@/components/brand-logo";
import { Skeleton } from "@/components/ui/skeleton";
import type { TransactionReceipt } from "@/lib/transactions";
import { cn } from "@/lib/utils";

function metaString(meta: Record<string, unknown> | null, key: string) {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function isVirtualNumberTx(tx: TransactionReceipt) {
  return (
    tx.category === "virtual_number" ||
    tx.category === "numbers" ||
    Boolean(metaString(tx.metadata, "activationId")) ||
    Boolean(metaString(tx.metadata, "phoneNumber"))
  );
}

function isSocialBoostTx(tx: TransactionReceipt) {
  return (
    tx.category === "social" ||
    metaString(tx.metadata, "kind") === "social_boost" ||
    Boolean(metaString(tx.metadata, "japOrderId"))
  );
}

export default function TransactionReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [tx, setTx] = useState<TransactionReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/transactions/${id}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          error?: string;
          transaction?: TransactionReceipt;
        };
        if (!res.ok) throw new Error(json.error || "Failed to load receipt");
        if (!cancelled) setTx(json.transaction ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setTx(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function buildReceiptImage() {
    if (!tx) throw new Error("No transaction");
    const canvas = await renderReceiptCanvas(tx);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Could not create image");
    const filename = `oryno-receipt-${tx.reference}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    return { blob, file, filename };
  }

  async function onShare() {
    if (!tx) return;
    setSharing(true);
    try {
      const { blob, file, filename } = await buildReceiptImage();

      // Prefer native image share (WhatsApp, Messages, etc.)
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "ORYNO Receipt",
          text: `${tx.title} · ${tx.amount}`,
        });
        return;
      }

      if (typeof navigator.share === "function") {
        // Some browsers support share but not files — try file share anyway
        try {
          await navigator.share({
            files: [file],
            title: "ORYNO Receipt",
            text: `${tx.title} · ${tx.amount}`,
          });
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          // fall through to download
        }
      }

      // Fallback: download the image so the user can share it manually
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Receipt image ready", {
        description: "Image saved — share it from your gallery.",
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("Couldn’t share receipt image");
    } finally {
      setSharing(false);
    }
  }

  async function onDownload() {
    if (!tx) return;
    setDownloading(true);
    try {
      const { blob, filename } = await buildReceiptImage();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Receipt downloaded");
    } catch {
      toast.error("Couldn’t download receipt");
    } finally {
      setDownloading(false);
    }
  }

  const credit = tx?.type === "credit";

  return (
    <AppShell hideNav>
      <PageHeader
        title="Receipt"
        subtitle="Transaction details"
        backHref="/history"
        useHistoryBack
      />

      {loading ? (
        <MotionSection className="rounded-[28px] bg-background p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col items-center">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="mt-4 h-5 w-36 rounded-full" />
            <Skeleton className="mt-2 h-8 w-40 rounded-full" />
          </div>
          <div className="mt-8 space-y-3">
            <Skeleton className="h-12 w-full rounded-[14px]" />
            <Skeleton className="h-12 w-full rounded-[14px]" />
            <Skeleton className="h-12 w-full rounded-[14px]" />
          </div>
        </MotionSection>
      ) : error || !tx ? (
        <MotionSection className="rounded-[28px] bg-background px-6 py-14 text-center shadow-[var(--shadow-soft)]">
          <p className="text-lg font-bold text-foreground">
            Receipt unavailable
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {error ?? "This transaction could not be found."}
          </p>
        </MotionSection>
      ) : (
        <>
          <MotionSection>
            <div
              ref={receiptRef}
              className="overflow-hidden rounded-[28px] bg-background shadow-[var(--shadow-soft)]"
            >
              <div className="bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] px-5 py-6 text-white">
                <div className="flex items-center gap-3">
                  <BrandLogo size={44} className="ring-1 ring-white/25" />
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.2em] text-white/85 uppercase">
                      ORYNO
                    </p>
                    <p className="text-sm font-semibold">Transaction receipt</p>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <StatusHeroIcon status={tx.status} />
                  <p className="mt-3 text-sm text-white/80">{tx.title}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">
                    {tx.amount}
                  </p>
                  <StatusPill status={tx.status} />
                </div>
              </div>

              <div className="relative overflow-hidden px-5 py-2">
                <ReceiptWatermark />
                <div className="relative z-10 space-y-0 divide-y divide-border">
                  <DetailRow label="Category" value={tx.categoryLabel} />
                  <DetailRow label="Details" value={tx.subtitle} />
                  {tx.category === "refund" && credit ? (
                    <div className="border-t border-border px-0 py-4">
                      <p className="rounded-[14px] bg-muted/50 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                        This credit was added back to your{" "}
                        <span className="font-semibold text-foreground">
                          ORYNO wallet balance
                        </span>
                        . It is not a refund to your bank account. Check Wallet
                        for your current balance.
                      </p>
                    </div>
                  ) : null}
                  <DetailRow label="Type" value={credit ? "Credit" : "Debit"} />
                  <DetailRow label="Date" value={tx.createdAtFormatted} />
                  <DetailRow label="Reference" value={tx.reference} mono />
                  <DetailRow label="Currency" value={tx.currency ?? "NGN"} />
                  {isVirtualNumberTx(tx) ? (
                    <VirtualNumberDetails meta={tx.metadata} />
                  ) : null}
                  {isSocialBoostTx(tx) ? (
                    <SocialBoostDetails meta={tx.metadata} />
                  ) : null}
                </div>
              </div>

              <p className="px-5 pb-5 pt-2 text-center text-[11px] text-muted-foreground">
                Powered by ORYNO · Keep this receipt for your records
              </p>
            </div>
          </MotionSection>

          {isVirtualNumberTx(tx) ? (
            <MotionSection delay={0.04} className="mt-5">
              <VirtualNumberCodePanel tx={tx} />
            </MotionSection>
          ) : null}

          {isSocialBoostTx(tx) ? (
            <MotionSection delay={0.04} className="mt-5">
              <SocialBoostStatusPanel tx={tx} />
            </MotionSection>
          ) : null}

          <MotionSection delay={0.06} className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={sharing}
              onClick={() => void onShare()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[16px] border border-border bg-background text-sm font-semibold text-foreground shadow-[var(--shadow-soft)] disabled:opacity-50"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4 text-primary" />
              )}
              Share
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={() => void onDownload()}
              className="btn-primary inline-flex h-12 items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </button>
          </MotionSection>
        </>
      )}
    </AppShell>
  );
}

function VirtualNumberDetails({
  meta,
}: {
  meta: Record<string, unknown> | null;
}) {
  const phone = metaString(meta, "phoneNumber");
  const service = metaString(meta, "service");
  if (!phone && !service) return null;
  return (
    <>
      {phone ? <DetailRow label="Phone" value={phone} mono /> : null}
      {service ? <DetailRow label="Service" value={service} /> : null}
    </>
  );
}

function SocialBoostDetails({
  meta,
}: {
  meta: Record<string, unknown> | null;
}) {
  const link = metaString(meta, "link");
  const qty = meta?.quantity;
  const quantity =
    typeof qty === "number"
      ? qty.toLocaleString()
      : typeof qty === "string"
        ? qty
        : null;
  if (!link && !quantity) return null;
  return (
    <>
      {quantity ? <DetailRow label="Quantity" value={quantity} /> : null}
      {link ? <DetailRow label="Link" value={link} mono /> : null}
    </>
  );
}

function SocialBoostStatusPanel({ tx }: { tx: TransactionReceipt }) {
  const orderId =
    metaString(tx.metadata, "japOrderId") || tx.externalRef;
  const cached = metaString(tx.metadata, "japStatus");

  const [status, setStatus] = useState<string | null>(cached);
  const [remains, setRemains] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!orderId) {
      setError("Order id missing for this boost");
      return;
    }
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/jap/status/${encodeURIComponent(orderId)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        error?: string;
        data?: {
          status?: string;
          remains?: string;
          start_count?: string;
        };
      };
      if (!res.ok) throw new Error(data.error || "Could not get status");
      if (data.data?.status) setStatus(String(data.data.status));
      if (data.data?.remains != null) setRemains(String(data.data.remains));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not get status");
    } finally {
      setFetching(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    if (cached && /complet|partial|cancel|fail/i.test(cached)) return;
    void fetchStatus();
  }, [orderId, cached, fetchStatus]);

  if (!orderId) return null;

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <TrendingUp className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Boost status</p>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="rounded-[16px] bg-muted/50 px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Provider status
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {status || (fetching ? "Checking…" : "—")}
          </p>
          {remains != null && remains !== "" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Remaining: {remains}
            </p>
          ) : null}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <button
          type="button"
          disabled={!orderId || fetching}
          onClick={() => void fetchStatus()}
          className="btn-primary inline-flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {fetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh status
        </button>
      </div>
    </div>
  );
}

function VirtualNumberCodePanel({ tx }: { tx: TransactionReceipt }) {
  const activationId =
    metaString(tx.metadata, "activationId") || tx.externalRef;
  const phone = metaString(tx.metadata, "phoneNumber");
  const cachedCode = metaString(tx.metadata, "smsCode");

  const [code, setCode] = useState<string | null>(cachedCode);
  const [fetching, setFetching] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCode = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!activationId) {
        setError("Activation id missing for this number");
        return null;
      }
      if (!opts?.silent) setFetching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/services/numbers/status/${encodeURIComponent(activationId)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          error?: string;
          code?: string | null;
          data?: { code?: string | null };
        };
        if (!res.ok) throw new Error(data.error || "Could not get SMS code");
        const next =
          (typeof data.code === "string" && data.code) ||
          (typeof data.data?.code === "string" && data.data.code) ||
          null;
        if (next) {
          setCode(next);
          setPolling(false);
        }
        return next;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Could not get SMS code";
        setError(msg);
        return null;
      } finally {
        if (!opts?.silent) setFetching(false);
      }
    },
    [activationId],
  );

  useEffect(() => {
    setCode(cachedCode);
  }, [cachedCode, tx.id]);

  useEffect(() => {
    if (!activationId || code) return;
    let cancelled = false;
    let tries = 0;
    setPolling(true);

    async function tick() {
      if (cancelled) return;
      tries += 1;
      const next = await fetchCode({ silent: true });
      if (cancelled) return;
      if (next || tries >= 40) {
        setPolling(false);
        return;
      }
      window.setTimeout(tick, 5000);
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [activationId, code, fetchCode]);

  async function onCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }

  if (!activationId && !phone && !code) return null;

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <MessageSquareText className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">SMS code</p>
      </div>

      <div className="space-y-3 px-5 py-4">
        {phone ? (
          <div className="flex items-center justify-between gap-3 rounded-[16px] bg-muted/50 px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Phone number
              </p>
              <p className="mt-0.5 truncate font-mono text-sm font-semibold text-foreground">
                {phone}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onCopy(phone, "Phone number")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
              aria-label="Copy phone number"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-[16px] bg-muted/50 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Verification code
            </p>
            <p
              className={cn(
                "mt-0.5 truncate text-sm font-semibold text-foreground",
                code ? "font-mono tracking-wider" : "text-muted-foreground",
              )}
            >
              {code ||
                (polling || fetching ? "Waiting for SMS…" : "Not received yet")}
            </p>
          </div>
          {code ? (
            <button
              type="button"
              onClick={() => void onCopy(code, "SMS code")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
              aria-label="Copy SMS code"
            >
              <Copy className="h-4 w-4" />
            </button>
          ) : polling || fetching ? (
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-primary" />
          ) : (
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}

        <button
          type="button"
          disabled={!activationId || fetching}
          onClick={() => void fetchCode()}
          className="btn-primary inline-flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {fetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {code ? "Refresh code" : "Get code"}
        </button>
      </div>
    </div>
  );
}

function normalizeStatus(status: string): "Successful" | "Pending" | "Failed" | "Reversed" {
  const s = status.toLowerCase();
  if (s === "reversed") return "Reversed";
  if (s === "failed") return "Failed";
  if (s === "pending" || s === "processing") return "Pending";
  if (s === "completed" || s === "successful" || s === "success") return "Successful";
  return "Successful";
}

function StatusHeroIcon({ status }: { status: string }) {
  const label = normalizeStatus(status);
  const Icon =
    label === "Failed"
      ? XCircle
      : label === "Reversed"
        ? RotateCcw
        : label === "Pending"
          ? Clock3
          : CheckCircle2;

  return (
    <span className="mx-auto flex h-14 w-14 items-center justify-center">
      <Icon className="h-full w-full text-white" strokeWidth={1.75} />
    </span>
  );
}

function ReceiptWatermark() {
  const marks = Array.from({ length: 36 }, (_, i) => i);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute -inset-16 grid rotate-[-32deg] grid-cols-4 gap-x-10 gap-y-9 opacity-[0.055] dark:opacity-[0.08] sm:grid-cols-5">
        {marks.map((i) => (
          <span
            key={i}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          >
            <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full opacity-[0.22] grayscale contrast-50 brightness-110">
              <Image
                src={BRAND_LOGO_SRC}
                alt=""
                fill
                sizes="20px"
                className="object-cover"
              />
            </span>
            <span className="text-[13px] font-bold tracking-[0.04em] text-foreground dark:text-white">
              ORYNO
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = normalizeStatus(status);
  const Icon =
    label === "Failed"
      ? XCircle
      : label === "Reversed"
        ? RotateCcw
        : label === "Pending"
          ? Clock3
          : CheckCircle2;
  return (
    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "max-w-[60%] text-right text-sm font-semibold text-foreground capitalize",
          mono && "font-mono text-xs tracking-wide normal-case",
        )}
      >
        {value}
      </p>
    </div>
  );
}

async function renderReceiptCanvas(tx: TransactionReceipt) {
  // ~80mm thermal receipt strip at crisp digital density
  const width = 400;
  const padX = 24;
  const rowH = 40;
  const rows = [
    ["Category", tx.categoryLabel],
    ["Details", tx.subtitle],
    ["Type", tx.type === "credit" ? "Credit" : "Debit"],
    ["Date", tx.createdAtFormatted],
    ["Reference", tx.reference],
    ["Currency", tx.currency ?? "NGN"],
  ];
  const detailsTop = 240;
  const height = detailsTop + rows.length * rowH + 64;
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  // Background (theme-aware)
  ctx.fillStyle = isDark ? "#1C1C1E" : "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Orange header
  const headerH = 220;
  const grad = ctx.createLinearGradient(0, 0, width, headerH);
  grad.addColorStop(0, "#ff8124");
  grad.addColorStop(0.5, "#FF6A00");
  grad.addColorStop(1, "#e85d00");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, headerH);

  const logo = await loadReceiptLogo();
  if (logo) {
    const size = 36;
    const x = padX;
    const y = 22;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, x, y, size, size);
    ctx.restore();
  }

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillText("ORYNO", logo ? padX + 48 : padX, 38);
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Transaction receipt", logo ? padX + 48 : padX, 60);

  // Status icon fills circle (no tinted ring)
  const status = normalizeStatus(tx.status);
  const iconCx = width / 2;
  const iconCy = 104;
  drawStatusGlyph(ctx, status, iconCx, iconCy, 24);

  ctx.textAlign = "center";
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(tx.title, width / 2, 148);
  ctx.font = "bold 32px system-ui, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(tx.amount, width / 2, 186);
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(status, width / 2, 208);

  // Repeating slanted ORYNO watermark (OPay-style)
  const detailsH = rows.length * rowH + 24;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, detailsTop - 8, width, detailsH);
  ctx.clip();
  ctx.translate(width / 2, detailsTop + detailsH / 2);
  ctx.rotate((-32 * Math.PI) / 180);
  const markW = 130;
  const markH = 46;
  for (let row = -4; row <= 4; row += 1) {
    for (let col = -4; col <= 4; col += 1) {
      const x = col * markW + (row % 2 === 0 ? 0 : markW / 2);
      const y = row * markH;
      if (logo) {
        ctx.save();
        ctx.globalAlpha = isDark ? 0.022 : 0.016;
        ctx.beginPath();
        ctx.arc(x - 36, y, 8, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(logo, x - 44, y - 8, 16, 16);
        ctx.restore();
      }
      ctx.globalAlpha = isDark ? 0.08 : 0.055;
      ctx.fillStyle = isDark ? "#FFFFFF" : "#1C1C1E";
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("ORYNO", x - 24, y + 4);
    }
  }
  ctx.restore();

  ctx.textAlign = "left";
  let y = detailsTop + 16;
  const maxValueWidth = width - padX * 2 - 88;
  for (const [label, value] of rows) {
    ctx.fillStyle = isDark ? "#A1A1A6" : "#8A8A8E";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), padX, y);
    ctx.fillStyle = isDark ? "#F5F5F7" : "#1C1C1E";
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.textAlign = "right";
    const display = truncateToWidth(ctx, value, maxValueWidth);
    ctx.fillText(display, width - padX, y);
    ctx.textAlign = "left";
    y += rowH;
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "#EFEFEF";
    ctx.beginPath();
    ctx.moveTo(padX, y - 22);
    ctx.lineTo(width - padX, y - 22);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = isDark ? "#A1A1A6" : "#8A8A8E";
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText(
    "Powered by ORYNO · Keep this receipt for your records",
    width / 2,
    height - 24,
  );

  return canvas;
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1) {
    truncated = truncated.slice(0, -1);
    if (ctx.measureText(`${truncated}…`).width <= maxWidth) {
      return `${truncated}…`;
    }
  }
  return "…";
}

function drawStatusGlyph(
  ctx: CanvasRenderingContext2D,
  status: "Successful" | "Pending" | "Failed" | "Reversed" | string,
  cx: number,
  cy: number,
  radius = 28,
) {
  ctx.save();
  ctx.strokeStyle = "#FFFFFF";
  ctx.fillStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(2.5, radius * 0.1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Outer circle fills the whole icon area
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (status === "Failed" || status === "Reversed") {
    const s = radius * 0.38;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s);
    ctx.lineTo(cx + s, cy + s);
    ctx.moveTo(cx + s, cy - s);
    ctx.lineTo(cx - s, cy + s);
    ctx.stroke();
  } else if (status === "Pending") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius * 0.35);
    ctx.lineTo(cx, cy + radius * 0.08);
    ctx.lineTo(cx + radius * 0.28, cy + radius * 0.22);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.38, cy + radius * 0.02);
    ctx.lineTo(cx - radius * 0.08, cy + radius * 0.34);
    ctx.lineTo(cx + radius * 0.42, cy - radius * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

function loadReceiptLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = BRAND_LOGO_SRC;
  });
}
