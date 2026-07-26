"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  Share2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { BrandLogo } from "@/components/brand-logo";
import { Skeleton } from "@/components/ui/skeleton";
import type { TransactionReceipt } from "@/lib/transactions";
import { cn } from "@/lib/utils";

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

  const shareText = useCallback(() => {
    if (!tx) return "";
    return [
      "ORYNO Transaction Receipt",
      `${tx.title} · ${tx.amount}`,
      `Status: ${tx.status}`,
      `Ref: ${tx.reference}`,
      `Date: ${tx.createdAtFormatted}`,
      tx.subtitle ? `Details: ${tx.subtitle}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }, [tx]);

  async function onShare() {
    if (!tx) return;
    setSharing(true);
    try {
      const text = shareText();
      if (navigator.share) {
        await navigator.share({
          title: "ORYNO Receipt",
          text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Receipt copied", {
          description: "Share text is on your clipboard.",
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(shareText());
        toast.success("Receipt copied");
      } catch {
        toast.error("Couldn’t share receipt");
      }
    } finally {
      setSharing(false);
    }
  }

  async function onDownload() {
    if (!tx || !receiptRef.current) return;
    setDownloading(true);
    try {
      const canvas = await renderReceiptCanvas(tx);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Could not create image");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oryno-receipt-${tx.reference}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Receipt downloaded");
    } catch {
      // Fallback: download a simple text receipt
      try {
        const blob = new Blob([shareText()], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `oryno-receipt-${tx.reference}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Receipt downloaded");
      } catch {
        toast.error("Couldn’t download receipt");
      }
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
        <MotionSection className="rounded-[28px] border border-border bg-background p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col items-center">
            <Skeleton className="h-14 w-14 rounded-2xl" />
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
        <MotionSection className="rounded-[28px] border border-border bg-background px-6 py-14 text-center shadow-[var(--shadow-soft)]">
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
              className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]"
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
                  <span
                    className={cn(
                      "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25",
                    )}
                  >
                    {credit ? (
                      <ArrowDownLeft className="h-6 w-6" />
                    ) : (
                      <ArrowUpRight className="h-6 w-6" />
                    )}
                  </span>
                  <p className="mt-3 text-sm text-white/80">{tx.title}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight">
                    {tx.amount}
                  </p>
                  <StatusPill status={tx.status} />
                </div>
              </div>

              <div className="space-y-0 divide-y divide-border px-5 py-2">
                <DetailRow label="Category" value={tx.categoryLabel} />
                <DetailRow label="Details" value={tx.subtitle} />
                <DetailRow label="Type" value={credit ? "Credit" : "Debit"} />
                <DetailRow label="Date" value={tx.createdAtFormatted} />
                <DetailRow label="Reference" value={tx.reference} mono />
                {tx.balanceAfterFormatted ? (
                  <DetailRow
                    label="Balance after"
                    value={tx.balanceAfterFormatted}
                  />
                ) : null}
                <DetailRow label="Currency" value={tx.currency ?? "NGN"} />
              </div>

              <p className="px-5 pb-5 pt-2 text-center text-[11px] text-muted-foreground">
                Powered by ORYNO · Keep this receipt for your records
              </p>
            </div>
          </MotionSection>

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

function StatusPill({ status }: { status: string }) {
  const meta =
    status === "Failed"
      ? {
          label: "Failed",
          className: "bg-white/15 text-white",
          Icon: XCircle,
        }
      : status === "Pending"
        ? {
            label: "Pending",
            className: "bg-white/15 text-white",
            Icon: Clock3,
          }
        : {
            label: "Completed",
            className: "bg-white/15 text-white",
            Icon: CheckCircle2,
          };
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        meta.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
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

function renderReceiptCanvas(tx: TransactionReceipt) {
  const width = 720;
  const rowH = 44;
  const rows = [
    ["Category", tx.categoryLabel],
    ["Details", tx.subtitle],
    ["Type", tx.type === "credit" ? "Credit" : "Debit"],
    ["Date", tx.createdAtFormatted],
    ["Reference", tx.reference],
    ...(tx.balanceAfterFormatted
      ? [["Balance after", tx.balanceAfterFormatted] as const]
      : []),
    ["Currency", tx.currency ?? "NGN"],
  ];
  const height = 280 + rows.length * rowH + 60;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Orange header
  const grad = ctx.createLinearGradient(0, 0, width, 220);
  grad.addColorStop(0, "#ff8124");
  grad.addColorStop(0.5, "#FF6A00");
  grad.addColorStop(1, "#e85d00");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 230);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText("ORYNO", 40, 48);
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Transaction receipt", 40, 74);

  ctx.textAlign = "center";
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(tx.title, width / 2, 130);
  ctx.font = "bold 42px system-ui, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(tx.amount, width / 2, 180);
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(tx.status, width / 2, 210);

  ctx.textAlign = "left";
  let y = 270;
  for (const [label, value] of rows) {
    ctx.fillStyle = "#8A8A8E";
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), 40, y);
    ctx.fillStyle = "#1C1C1E";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.textAlign = "right";
    const display = value.length > 36 ? `${value.slice(0, 36)}…` : value;
    ctx.fillText(display, width - 40, y);
    ctx.textAlign = "left";
    y += rowH;
    ctx.strokeStyle = "#EFEFEF";
    ctx.beginPath();
    ctx.moveTo(40, y - 24);
    ctx.lineTo(width - 40, y - 24);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#8A8A8E";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(
    "Powered by ORYNO · Keep this receipt for your records",
    width / 2,
    height - 28,
  );

  return canvas;
}
