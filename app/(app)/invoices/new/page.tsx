"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { useCountry } from "@/components/providers/country-provider";

type Line = { description: string; quantity: string; unitPrice: string };

export default function NewInvoicePage() {
  const router = useRouter();
  const { country } = useCountry();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Line[]>([
    { description: "", quantity: "1", unitPrice: "" },
  ]);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          notes,
          currency: country.currency,
          items: items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success("Invoice created");
      router.push(`/invoices/${json.invoice.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="New invoice" subtitle="Free · Powered by ORYNO" useHistoryBack />
      <MotionSection>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Customer name</span>
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Customer email</span>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <div className="space-y-3">
            <p className="text-sm font-medium">Line items</p>
            {items.map((item, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-3">
                <input
                  required
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...item, description: e.target.value };
                    setItems(next);
                  }}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm sm:col-span-1"
                />
                <input
                  required
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...item, quantity: e.target.value };
                    setItems(next);
                  }}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                />
                <input
                  required
                  placeholder={`Unit price (${country.currency})`}
                  value={item.unitPrice}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...item, unitPrice: e.target.value };
                    setItems(next);
                  }}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { description: "", quantity: "1", unitPrice: "" },
                ])
              }
              className="text-sm font-semibold text-[#FF6A00]"
            >
              + Add line
            </button>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[#FF6A00] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create invoice"}
          </button>
        </form>
      </MotionSection>
    </AppShell>
  );
}
