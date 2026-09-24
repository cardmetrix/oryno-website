"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { useCountry } from "@/components/providers/country-provider";

export default function NewPaymentLinkPage() {
  const router = useRouter();
  const { country } = useCountry();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/payment-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          amount: Number(amount),
          currency: country.currency,
          customerName,
          customerEmail,
          note,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      if (json.url) {
        await navigator.clipboard.writeText(json.url);
      }
      toast.success("Payment link created and copied");
      router.push("/payment-links");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="New payment link"
        subtitle="Standalone checkout - separate from invoices"
        useHistoryBack
      />
      <MotionSection>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Title</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Website deposit"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Amount ({country.currency})</span>
            <input
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Customer name (optional)</span>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Customer email (optional)</span>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary h-11 w-full text-sm disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create link"}
          </button>
        </form>
      </MotionSection>
    </AppShell>
  );
}
