"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { formatMoney } from "@/lib/transactions";

const INVOICE_FOOTER =
  "Powered by ORYNO — Your Digital World, Simplified.";

type Packed = {
  invoice: {
    id: string;
    number: string;
    customerName: string;
    customerEmail: string | null;
    currency: string;
    total: string;
    notes: string | null;
    status: string;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
  paymentLink: { slug: string; status: string } | null;
  url?: string;
};

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Packed | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

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

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Invoice" useHistoryBack />
        <p className="text-sm text-muted-foreground">Loading…</p>
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

  const { invoice, items } = data;
  const payUrl =
    data.url ||
    (data.paymentLink ? `${window.location.origin}/pay/${data.paymentLink.slug}` : null);

  return (
    <AppShell>
      <PageHeader
        title={invoice.number}
        subtitle={invoice.customerName}
        useHistoryBack
      />
      <MotionSection>
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Bill to
              </p>
              <p className="font-semibold">{invoice.customerName}</p>
              {invoice.customerEmail ? (
                <p className="text-sm text-muted-foreground">
                  {invoice.customerEmail}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <p className="font-semibold capitalize">{invoice.status}</p>
            </div>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{item.description}</p>
                  <p className="text-muted-foreground">
                    {item.quantity} ×{" "}
                    {formatMoney(Number(item.unitPrice), invoice.currency)}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatMoney(Number(item.amount), invoice.currency)}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <p className="font-semibold">Total</p>
            <p className="text-lg font-bold text-[#FF6A00]">
              {formatMoney(Number(invoice.total), invoice.currency)}
            </p>
          </div>
          {invoice.notes ? (
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          ) : null}
          <p className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
            {INVOICE_FOOTER}
          </p>
        </div>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => void createLink()}
            disabled={linking}
            className="w-full rounded-xl bg-[#FF6A00] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {linking
              ? "Creating…"
              : payUrl
                ? "Copy payment link"
                : "Create payment link"}
          </button>
          {payUrl ? (
            <p className="break-all text-center text-xs text-muted-foreground">
              {payUrl}
            </p>
          ) : null}
        </div>
      </MotionSection>
    </AppShell>
  );
}
