"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { INVOICE_FOOTER } from "@/lib/invoices/constants";

type Packed = {
  invoice: {
    id: string;
    number: string;
    fromName: string | null;
    fromEmail: string | null;
    fromPhone: string | null;
    fromAddress: string | null;
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    shipToName: string | null;
    shipToAddress: string | null;
    currency: string;
    notes: string | null;
    terms: string | null;
    paymentTerms: string | null;
    poNumber: string | null;
    status: string;
    issuedAt: string | null;
    dueAt: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
  summary: {
    subtotalFormatted: string;
    taxFormatted: string;
    taxRate: number;
    discountFormatted: string;
    discount: number;
    shippingFormatted: string;
    shipping: number;
    totalFormatted: string;
    amountPaidFormatted: string;
    amountPaid: number;
    balanceDueFormatted: string;
    issuedAt: string;
    dueAt: string | null;
  };
  paymentLink: { slug: string; status: string } | null;
  url?: string;
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Packed | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invoices/${params.id}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Not found");
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function createLink() {
    setLinking(true);
    try {
      const res = await fetch(`/api/invoices/${params.id}/payment-link`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData((prev) =>
        prev
          ? {
              ...prev,
              paymentLink: json.paymentLink,
              url: json.url,
              invoice: json.invoice || prev.invoice,
              items: json.items || prev.items,
              summary: json.summary || prev.summary,
            }
          : json,
      );
      if (json.url) {
        await navigator.clipboard.writeText(json.url);
        toast.success("Payment link created and copied");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLinking(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/invoices/${params.id}/pdf`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "PDF failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${data?.invoice.number || params.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Invoice" useHistoryBack />
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-7 w-36 rounded-lg" />
                <Skeleton className="h-4 w-28 rounded-full" />
              </div>
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-14 rounded-full" />
                  <Skeleton className="h-4 w-32 rounded-full" />
                  <Skeleton className="h-3 w-40 rounded-full" />
                  <Skeleton className="h-3 w-28 rounded-full" />
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-5/6 rounded-lg" />
            </div>
            <div className="mt-6 ml-auto w-full max-w-xs space-y-2">
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-5 w-full rounded-full" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <PageHeader title="Invoice" useHistoryBack />
        <p className="text-sm text-destructive">Invoice not found</p>
      </AppShell>
    );
  }

  const { invoice, items, summary } = data;
  const payUrl =
    data.url ||
    (data.paymentLink
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${data.paymentLink.slug}`
      : null);

  return (
    <AppShell>
      <PageHeader
        title={invoice.number}
        subtitle={`${invoice.customerName} · ${invoice.status}`}
        useHistoryBack
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={downloading}
              className="btn-secondary inline-flex h-10 items-center gap-1.5 px-3 text-sm"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF
            </button>
          </div>
        }
      />

      <MotionSection className="overflow-hidden rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-2xl font-bold tracking-tight">INVOICE</p>
            <p className="text-sm text-muted-foreground"># {invoice.number}</p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase">
            {invoice.status}
          </span>
        </div>

        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
          <Meta label="Date" value={fmtDate(summary.issuedAt)} />
          <Meta label="Payment Terms" value={invoice.paymentTerms || "-"} />
          <Meta label="Due Date" value={fmtDate(summary.dueAt)} />
          <Meta label="PO Number" value={invoice.poNumber || "-"} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Party
            label="From"
            name={invoice.fromName}
            lines={[invoice.fromEmail, invoice.fromPhone, invoice.fromAddress]}
          />
          <Party
            label="Bill To"
            name={invoice.customerName}
            lines={[
              invoice.customerEmail,
              invoice.customerPhone,
              invoice.customerAddress,
            ]}
          />
          <Party
            label="Ship To"
            name={invoice.shipToName}
            lines={[invoice.shipToAddress]}
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-2 font-semibold">Item</th>
                <th className="pb-2 font-semibold">Qty</th>
                <th className="pb-2 font-semibold">Rate</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="py-2 pr-2">{item.description}</td>
                  <td className="py-2">{Number(item.quantity)}</td>
                  <td className="py-2">{item.unitPrice}</td>
                  <td className="py-2 text-right font-semibold">{item.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1.5 text-sm">
          <Row label="Subtotal" value={summary.subtotalFormatted} />
          {summary.discount > 0 ? (
            <Row label="Discount" value={`-${summary.discountFormatted}`} />
          ) : null}
          {summary.taxRate > 0 || Number(summary.taxFormatted.replace(/[^\d.-]/g, "")) > 0 ? (
            <Row
              label={`Tax (${summary.taxRate}%)`}
              value={summary.taxFormatted}
            />
          ) : null}
          {summary.shipping > 0 ? (
            <Row label="Shipping" value={summary.shippingFormatted} />
          ) : null}
          <Row label="Total" value={summary.totalFormatted} bold />
          {summary.amountPaid > 0 ? (
            <Row label="Amount Paid" value={summary.amountPaidFormatted} />
          ) : null}
          <Row label="Balance Due" value={summary.balanceDueFormatted} bold />
        </div>

        {invoice.notes ? (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Notes
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        ) : null}
        {invoice.terms ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Terms
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{invoice.terms}</p>
          </div>
        ) : null}

        <p className="mt-6 border-t border-border pt-3 text-center text-[11px] text-muted-foreground">
          {INVOICE_FOOTER}
        </p>
      </MotionSection>

      <MotionSection delay={0.06} className="mt-4 space-y-3">
        <button
          type="button"
          disabled={downloading}
          onClick={() => void downloadPdf()}
          className="btn-secondary inline-flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download PDF
        </button>
        <button
          type="button"
          disabled={linking}
          onClick={() => void createLink()}
          className="btn-primary inline-flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
        >
          {linking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {data.paymentLink ? "Copy payment link" : "Create payment link"}
        </button>
        {payUrl ? (
          <p className="break-all text-center text-xs text-muted-foreground">
            {payUrl}
          </p>
        ) : null}
        <p className="text-center text-[11px] text-muted-foreground">
          Payment links are separate from the invoice PDF. Share either or both.
        </p>
      </MotionSection>
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function Party({
  label,
  name,
  lines,
}: {
  label: string;
  name: string | null | undefined;
  lines: (string | null | undefined)[];
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{name || "-"}</p>
      {lines.filter(Boolean).map((line) => (
        <p key={String(line)} className="text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${bold ? "text-base font-bold" : ""}`}
    >
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
