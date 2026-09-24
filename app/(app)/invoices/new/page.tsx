"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { useCountry } from "@/components/providers/country-provider";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

type Line = { description: string; quantity: string; unitPrice: string };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const label = "block space-y-1.5 text-sm";

export default function NewInvoicePage() {
  const router = useRouter();
  const { country } = useCountry();
  const { user } = useUser();

  const [fromName, setFromName] = useState(user?.fullName || "");
  const [fromEmail, setFromEmail] = useState(
    user?.primaryEmailAddress?.emailAddress || "",
  );
  const [fromPhone, setFromPhone] = useState("");
  const [fromAddress, setFromAddress] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [shipToName, setShipToName] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");

  const [issuedAt, setIssuedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [dueAt, setDueAt] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Due on receipt");
  const [poNumber, setPoNumber] = useState("");

  const [items, setItems] = useState<Line[]>([
    { description: "", quantity: "1", unitPrice: "" },
  ]);
  const [taxRate, setTaxRate] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [shipping, setShipping] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);

  const currency = country.currency;

  const totals = useMemo(() => {
    const normalized = items.map((item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      return round2(quantity * unitPrice);
    });
    const subtotal = round2(normalized.reduce((s, n) => s + n, 0));
    const disc = Math.max(0, round2(Number(discount) || 0));
    const ship = Math.max(0, round2(Number(shipping) || 0));
    const rate = Math.max(0, Number(taxRate) || 0);
    const taxable = Math.max(0, subtotal - disc);
    const tax = round2((taxable * rate) / 100);
    const total = round2(taxable + tax + ship);
    const paid = Math.max(0, round2(Number(amountPaid) || 0));
    return {
      subtotal,
      discount: disc,
      shipping: ship,
      tax,
      total,
      amountPaid: paid,
      balanceDue: round2(Math.max(0, total - paid)),
    };
  }, [items, taxRate, discount, shipping, amountPaid]);

  async function onSubmit(e: FormEvent, asDraft: boolean) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: asDraft ? "draft" : "sent",
          currency,
          fromName,
          fromEmail,
          fromPhone,
          fromAddress,
          customerName,
          customerEmail,
          customerPhone,
          customerAddress,
          shipToName,
          shipToAddress,
          issuedAt,
          dueAt: dueAt || null,
          paymentTerms,
          poNumber,
          notes,
          terms,
          taxRate: Number(taxRate) || 0,
          discount: Number(discount) || 0,
          shipping: Number(shipping) || 0,
          amountPaid: Number(amountPaid) || 0,
          items: items.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success(asDraft ? "Draft saved" : "Invoice created");
      router.push(`/invoices/${json.invoice.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Invoice Generator"
        subtitle="Create professional invoices with one click"
        useHistoryBack
      />

      <MotionSection>
        <form
          onSubmit={(e) => void onSubmit(e, false)}
          className="overflow-hidden rounded-[22px] border border-border bg-background shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
            <div>
              <p className="text-lg font-bold tracking-tight">INVOICE</p>
              <p className="text-xs text-muted-foreground"># Auto-assigned</p>
            </div>
            <span className="rounded-full bg-oryno-orange-muted px-2.5 py-1 text-[10px] font-bold text-primary">
              FREE
            </span>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className={label}>
                <span className="font-medium text-muted-foreground">
                  Who is this from?
                </span>
                <input
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="Your business name"
                  className={field}
                />
                <input
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="Email"
                  className={field}
                />
                <input
                  value={fromPhone}
                  onChange={(e) => setFromPhone(e.target.value)}
                  placeholder="Phone"
                  className={field}
                />
                <textarea
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  placeholder="Address"
                  rows={2}
                  className={cn(field, "resize-none")}
                />
              </label>

              <label className={label}>
                <span className="font-medium text-muted-foreground">Bill To</span>
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Who is this to?"
                  className={field}
                />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Email"
                  className={field}
                />
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone"
                  className={field}
                />
                <textarea
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Billing address"
                  rows={2}
                  className={cn(field, "resize-none")}
                />
              </label>

              <label className={label}>
                <span className="font-medium text-muted-foreground">
                  Ship To (optional)
                </span>
                <input
                  value={shipToName}
                  onChange={(e) => setShipToName(e.target.value)}
                  placeholder="Recipient name"
                  className={field}
                />
                <textarea
                  value={shipToAddress}
                  onChange={(e) => setShipToAddress(e.target.value)}
                  placeholder="Shipping address"
                  rows={4}
                  className={cn(field, "resize-none")}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className={label}>
                <span className="font-medium text-muted-foreground">Date</span>
                <input
                  type="date"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                  className={field}
                />
              </label>
              <label className={label}>
                <span className="font-medium text-muted-foreground">
                  Payment Terms
                </span>
                <input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className={field}
                />
              </label>
              <label className={label}>
                <span className="font-medium text-muted-foreground">Due Date</span>
                <input
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className={field}
                />
              </label>
              <label className={label}>
                <span className="font-medium text-muted-foreground">
                  PO Number
                </span>
                <input
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className={field}
                />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-2 font-semibold">Item</th>
                    <th className="w-20 pb-2 font-semibold">Qty</th>
                    <th className="w-28 pb-2 font-semibold">Rate</th>
                    <th className="w-28 pb-2 text-right font-semibold">Amount</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const amount =
                      (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                    return (
                      <tr key={idx} className="border-b border-border/70">
                        <td className="py-2 pr-2">
                          <input
                            required
                            value={item.description}
                            onChange={(e) => {
                              const next = [...items];
                              next[idx] = {
                                ...item,
                                description: e.target.value,
                              };
                              setItems(next);
                            }}
                            placeholder="Description of item/service..."
                            className={field}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            required
                            value={item.quantity}
                            onChange={(e) => {
                              const next = [...items];
                              next[idx] = { ...item, quantity: e.target.value };
                              setItems(next);
                            }}
                            className={field}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            required
                            value={item.unitPrice}
                            onChange={(e) => {
                              const next = [...items];
                              next[idx] = {
                                ...item,
                                unitPrice: e.target.value,
                              };
                              setItems(next);
                            }}
                            placeholder="0"
                            className={field}
                          />
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums">
                          {money(amount, currency)}
                        </td>
                        <td className="py-2 pl-2">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() =>
                              setItems(items.filter((_, i) => i !== idx))
                            }
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() =>
                setItems([
                  ...items,
                  { description: "", quantity: "1", unitPrice: "" },
                ])
              }
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
            >
              <Plus className="h-4 w-4" /> Line Item
            </button>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className={label}>
                  <span className="font-medium text-muted-foreground">Notes</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes - any relevant information not already covered"
                    rows={3}
                    className={cn(field, "resize-none")}
                  />
                </label>
                <label className={label}>
                  <span className="font-medium text-muted-foreground">Terms</span>
                  <textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    placeholder="Terms and conditions - late fees, payment methods, delivery schedule"
                    rows={3}
                    className={cn(field, "resize-none")}
                  />
                </label>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4">
                <TotalsRow
                  label="Subtotal"
                  value={money(totals.subtotal, currency)}
                />
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Tax %</span>
                  <input
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="h-9 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm"
                  />
                </div>
                <TotalsRow label="Tax" value={money(totals.tax, currency)} />
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <input
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-right text-sm"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <input
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-right text-sm"
                  />
                </div>
                <TotalsRow
                  label="Total"
                  value={money(totals.total, currency)}
                  bold
                />
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <input
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-right text-sm"
                  />
                </div>
                <TotalsRow
                  label="Balance Due"
                  value={money(totals.balanceDue, currency)}
                  bold
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 px-4 py-3 sm:px-5">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary h-11 px-5 text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & Send"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={(e) => void onSubmit(e as unknown as FormEvent, true)}
              className="btn-secondary h-11 px-5 text-sm disabled:opacity-50"
            >
              Save draft
            </button>
          </div>
        </form>
      </MotionSection>
    </AppShell>
  );
}

function TotalsRow({
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
      className={cn(
        "flex items-center justify-between text-sm",
        bold && "pt-1 text-base font-bold",
      )}
    >
      <span className={bold ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
