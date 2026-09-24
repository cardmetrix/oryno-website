"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type PayInfo = {
  title: string;
  amountFormatted: string;
  status: string;
  customerName: string | null;
  invoiceNumber: string | null;
  footer: string;
};

export default function PublicPayPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [email, setEmail] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/pay/${params.slug}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setInfo(json);
    })();
  }, [params.slug, search]);

  async function pay() {
    setPaying(true);
    try {
      const res = await fetch(`/api/pay/${params.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Payment failed");
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      if (json.redirectUrl) {
        window.location.href = json.redirectUrl;
        return;
      }
      toast.success("Payment recorded");
      setInfo((prev) => (prev ? { ...prev, status: "paid" } : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPaying(false);
    }
  }

  if (!info) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading payment…</p>
      </main>
    );
  }

  const paid = info.status === "paid" || search.get("paid") === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#FF6A00]">
          ORYNO Pay
        </p>
        <h1 className="mt-2 text-2xl font-bold">{info.title}</h1>
        {info.invoiceNumber ? (
          <p className="text-sm text-muted-foreground">{info.invoiceNumber}</p>
        ) : null}
        <p className="mt-6 text-3xl font-bold">{info.amountFormatted}</p>
        {info.customerName ? (
          <p className="mt-2 text-sm text-muted-foreground">
            For {info.customerName}
          </p>
        ) : null}
        {paid ? (
          <p className="mt-6 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700">
            Payment received. Thank you.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void pay()}
              disabled={paying}
              className="w-full rounded-xl bg-[#FF6A00] py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {paying ? "Starting…" : "Pay now"}
            </button>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {info.footer}
        </p>
      </div>
    </main>
  );
}
