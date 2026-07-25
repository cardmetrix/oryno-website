"use client";

import { useState } from "react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

const networks = ["MTN", "Airtel", "Glo", "9mobile"];
const presets = ["100", "200", "500", "1000"];

export default function AirtimePage() {
  const [network, setNetwork] = useState("MTN");
  const [amount, setAmount] = useState("500");

  return (
    <AppShell hideNav>
      <PageHeader
        title="Buy Airtime"
        subtitle="Top up any phone line instantly with cash-back"
        backHref="/dashboard"
      />

      <MotionSection className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
        <p className="mb-3 text-sm font-medium text-foreground">
          Select Network
        </p>
        <div className="flex flex-wrap gap-2">
          {networks.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setNetwork(item)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                network === item
                  ? "border-primary bg-oryno-orange-muted text-primary"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="mt-6 block">
          <span className="text-sm font-medium text-foreground">
            Phone Number
          </span>
          <input
            defaultValue="0803 111 2222"
            className="mt-2 h-12 w-full rounded-[14px] border border-border bg-muted/40 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-foreground">
            Enter Amount (₦)
          </span>
          <input
            value={`₦ ${amount}`}
            onChange={(e) =>
              setAmount(e.target.value.replace(/[^\d]/g, "") || "0")
            }
            className="mt-2 h-12 w-full rounded-[14px] border border-border bg-muted/40 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                amount === preset
                  ? "bg-primary text-white shadow-[var(--shadow-orange)]"
                  : "bg-muted text-foreground",
              )}
            >
              ₦{preset}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-medium text-primary">
          You will earn ₦10.00 Cashback on this transaction.
        </p>
      </MotionSection>

      <MotionSection delay={0.08}>
        <button
          type="button"
          className="btn-primary mt-6 h-12 w-full text-base md:max-w-sm"
        >
          Buy Airtime
        </button>
      </MotionSection>
    </AppShell>
  );
}
