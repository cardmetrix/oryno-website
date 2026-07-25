"use client";

import { useState } from "react";
import { Building2, CreditCard, Hash } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

const presets = ["1000", "2000", "5000", "10000"];

const methods = [
  {
    id: "transfer",
    title: "Bank Transfer",
    description: "Instant automated bank transfer.",
    icon: Building2,
  },
  {
    id: "card",
    title: "Debit Card",
    description: "Visa, Mastercard, Verve",
    icon: CreditCard,
  },
  {
    id: "ussd",
    title: "USSD Code",
    description: "Direct dial checkout codes.",
    icon: Hash,
  },
];

export default function FundPage() {
  const [amount, setAmount] = useState("5000");
  const [method, setMethod] = useState("card");

  return (
    <AppShell hideNav>
      <PageHeader
        title="Fund Wallet"
        subtitle="Add money instantly with card, transfer, or USSD"
        backHref="/wallet"
      />

      <MotionSection className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
        <label className="block">
          <span className="text-sm font-medium text-foreground">
            Enter Amount
          </span>
          <div className="mt-2 flex h-16 items-center rounded-[16px] border-2 border-primary bg-muted/30 px-4">
            <span className="mr-2 text-xl font-semibold text-muted-foreground">
              ₦
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={Number(amount).toLocaleString("en-NG", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                setAmount(raw || "0");
              }}
              className="w-full bg-transparent text-2xl font-bold text-foreground outline-none"
            />
          </div>
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                amount === preset
                  ? "bg-primary text-white shadow-[var(--shadow-orange)]"
                  : "bg-muted text-foreground hover:bg-muted/80",
              )}
            >
              ₦{Number(preset).toLocaleString()}
            </button>
          ))}
        </div>
      </MotionSection>

      <MotionSection
        delay={0.08}
        className="mt-5 rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
      >
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Payment Method
        </h2>
        <div className="space-y-3">
          {methods.map((item) => {
            const Icon = item.icon;
            const selected = method === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMethod(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[16px] border px-4 py-3.5 text-left transition-colors",
                  selected
                    ? "border-primary bg-oryno-orange-muted/50"
                    : "border-border bg-background hover:bg-muted/50",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    selected ? "border-primary" : "border-border",
                  )}
                >
                  {selected ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </MotionSection>

      <MotionSection delay={0.12}>
        <button
          type="button"
          className="btn-primary mt-6 h-12 w-full text-base md:max-w-sm"
        >
          Fund Wallet Now
        </button>
      </MotionSection>
    </AppShell>
  );
}
