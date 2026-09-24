"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Link2, Plus } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type LinkRow = {
  id: string;
  title: string;
  amountFormatted: string;
  status: string;
  kind: string;
  slug: string;
  createdAt: string;
};

export default function PaymentLinksPage() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/payment-links", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        if (!cancelled) setRows(json.links || []);
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
        title="Payment Links"
        subtitle="Collect payments without creating an invoice"
        backHref="/services"
        actions={
          <Link
            href="/payment-links/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF6A00] px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> New
          </Link>
        }
      />
      <MotionSection>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 shadow-[var(--shadow-soft)]"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-36 rounded-full" />
                  <Skeleton className="h-3 w-24 rounded-full" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <Link2 className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-semibold">No payment links yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a standalone link to get paid for anything.
            </p>
            <Link
              href="/payment-links/new"
              className="mt-4 inline-flex rounded-xl bg-[#FF6A00] px-4 py-2 text-sm font-semibold text-white"
            >
              Create payment link
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <a
                  href={`/pay/${row.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 shadow-[var(--shadow-soft)]"
                >
                  <div>
                    <p className="font-semibold">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.kind} · {row.status}
                    </p>
                  </div>
                  <p className="font-bold tabular-nums">{row.amountFormatted}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </MotionSection>
    </AppShell>
  );
}
