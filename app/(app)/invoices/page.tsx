"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

type InvoiceRow = {
  id: string;
  number: string;
  customerName: string;
  totalFormatted: string;
  status: string;
};

export default function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/invoices", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        if (!cancelled) setRows(json.invoices || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <PageHeader
        title="Invoice Generator"
        subtitle="Create free professional invoices and download PDFs"
        actions={
          <Link
            href="/invoices/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF6A00] px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> New
          </Link>
        }
      />
      <MotionSection>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invoices...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-semibold">No invoices yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a free invoice and share a payment link.
            </p>
            <Link
              href="/invoices/new"
              className="mt-4 inline-flex rounded-xl bg-[#FF6A00] px-4 py-2 text-sm font-semibold text-white"
            >
              Create invoice
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/invoices/${row.id}`}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{row.number}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.customerName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{row.totalFormatted}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {row.status}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </MotionSection>
    </AppShell>
  );
}
