"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
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
import { BRAND_LOGO_SRC, BrandLogo } from "@/components/brand-logo";
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
        <MotionSection className="rounded-[28px] border border-border bg-background p-6 shadow-[var(--shadow-soft)]">
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
                  <DetailRow label="Type" value={credit ? "Credit" : "Debit"} />
                  <DetailRow label="Date" value={tx.createdAtFormatted} />
                  <DetailRow label="Reference" value={tx.reference} mono />
                  <DetailRow label="Currency" value={tx.currency ?? "NGN"} />
                </div>
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

function normalizeStatus(status: string): "Completed" | "Pending" | "Failed" {
  const s = status.toLowerCase();
  if (s === "failed") return "Failed";
  if (s === "pending") return "Pending";
  return "Completed";
}

function StatusHeroIcon({ status }: { status: string }) {
  const label = normalizeStatus(status);
  const Icon =
    label === "Failed"
      ? XCircle
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
  const width = 720;
  const rowH = 44;
  const rows = [
    ["Category", tx.categoryLabel],
    ["Details", tx.subtitle],
    ["Type", tx.type === "credit" ? "Credit" : "Debit"],
    ["Date", tx.createdAtFormatted],
    ["Reference", tx.reference],
    ["Currency", tx.currency ?? "NGN"],
  ];
  const detailsTop = 268;
  const height = detailsTop + rows.length * rowH + 70;
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
  const headerH = 248;
  const grad = ctx.createLinearGradient(0, 0, width, headerH);
  grad.addColorStop(0, "#ff8124");
  grad.addColorStop(0.5, "#FF6A00");
  grad.addColorStop(1, "#e85d00");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, headerH);

  const logo = await loadReceiptLogo();
  if (logo) {
    const size = 44;
    const x = 40;
    const y = 28;
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
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText("ORYNO", logo ? 96 : 40, 48);
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Transaction receipt", logo ? 96 : 40, 74);

  // Status icon fills circle (no tinted ring)
  const status = normalizeStatus(tx.status);
  const iconCx = width / 2;
  const iconCy = 118;
  drawStatusGlyph(ctx, status, iconCx, iconCy, 28);

  ctx.textAlign = "center";
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(tx.title, width / 2, 168);
  ctx.font = "bold 42px system-ui, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(tx.amount, width / 2, 212);
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(status, width / 2, 236);

  // Repeating slanted ORYNO watermark (OPay-style)
  const detailsH = rows.length * rowH + 24;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, detailsTop - 8, width, detailsH);
  ctx.clip();
  ctx.translate(width / 2, detailsTop + detailsH / 2);
  ctx.rotate((-32 * Math.PI) / 180);
  const markW = 150;
  const markH = 52;
  for (let row = -4; row <= 4; row += 1) {
    for (let col = -4; col <= 4; col += 1) {
      const x = col * markW + (row % 2 === 0 ? 0 : markW / 2);
      const y = row * markH;
      if (logo) {
        ctx.save();
        ctx.globalAlpha = isDark ? 0.022 : 0.016;
        ctx.beginPath();
        ctx.arc(x - 42, y, 9, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(logo, x - 51, y - 9, 18, 18);
        ctx.restore();
      }
      ctx.globalAlpha = isDark ? 0.08 : 0.055;
      ctx.fillStyle = isDark ? "#FFFFFF" : "#1C1C1E";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("ORYNO", x - 28, y + 5);
    }
  }
  ctx.restore();

  ctx.textAlign = "left";
  let y = detailsTop + 18;
  for (const [label, value] of rows) {
    ctx.fillStyle = isDark ? "#A1A1A6" : "#8A8A8E";
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), 40, y);
    ctx.fillStyle = isDark ? "#F5F5F7" : "#1C1C1E";
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.textAlign = "right";
    const display = value.length > 36 ? `${value.slice(0, 36)}…` : value;
    ctx.fillText(display, width - 40, y);
    ctx.textAlign = "left";
    y += rowH;
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "#EFEFEF";
    ctx.beginPath();
    ctx.moveTo(40, y - 24);
    ctx.lineTo(width - 40, y - 24);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = isDark ? "#A1A1A6" : "#8A8A8E";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(
    "Powered by ORYNO · Keep this receipt for your records",
    width / 2,
    height - 28,
  );

  return canvas;
}

function drawStatusGlyph(
  ctx: CanvasRenderingContext2D,
  status: "Completed" | "Pending" | "Failed" | string,
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

  if (status === "Failed") {
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
