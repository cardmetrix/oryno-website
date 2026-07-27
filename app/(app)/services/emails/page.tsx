"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Inbox,
  Mail,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceInstructions } from "@/components/app/service-instructions";
import { useCountry } from "@/components/providers/country-provider";
import { formatCountryMoney } from "@/lib/country";
import { cn } from "@/lib/utils";

type Domain = {
  name: string;
  costUsd: number;
  costLocal: number;
  currency: string;
  count: number;
};

const SITES = [
  { id: "telegram.com", label: "Telegram" },
  { id: "google.com", label: "Google" },
  { id: "instagram.com", label: "Instagram" },
  { id: "facebook.com", label: "Facebook" },
  { id: "discord.com", label: "Discord" },
  { id: "openai.com", label: "OpenAI" },
  { id: "other", label: "Other site" },
];

export default function EmailRentPage() {
  const { country } = useCountry();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [site, setSite] = useState("telegram.com");
  const [customSite, setCustomSite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [emailId, setEmailId] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [receipt, setReceipt] = useState("");

  const selected = domains.find((d) => d.name === domain);
  const siteValue = site === "other" ? customSite.trim() : site;

  const canSubmit = useMemo(
    () => Boolean(domain && siteValue && selected && !submitting),
    [domain, siteValue, selected, submitting],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/herosms/emails/domains");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (cancelled) return;
        setDomains(data.domains ?? []);
        if (data.domains?.[0]?.name) setDomain(data.domains[0].name);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load domains");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!success || !emailId || code) return;
    let cancelled = false;
    let tries = 0;

    async function tick() {
      if (cancelled || tries > 40) return;
      tries += 1;
      setPolling(true);
      try {
        const res = await fetch(
          `/api/herosms/status/email/${encodeURIComponent(emailId)}`,
        );
        const data = await res.json();
        const value = data.data?.value || data.data?.code;
        if (value) {
          setCode(String(value));
          setMessage(data.data?.message || null);
          setPolling(false);
          return;
        }
        if (data.data?.status === "OK" && data.data?.message) {
          setMessage(data.data.message);
        }
      } catch {
        // keep polling
      }
      setPolling(false);
      window.setTimeout(tick, 5000);
    }

    tick();
    return () => {
      cancelled = true;
    };
  }, [success, emailId, code]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/herosms/purchase/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: siteValue,
          domain: selected.name,
          priceUsd: selected.costUsd,
          priceLocal: selected.costLocal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setEmail(data.email);
      setEmailId(data.emailId);
      setReceipt(data.amountFormatted);
      setCode(null);
      setMessage(null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  }

  const money = (n: number) =>
    formatCountryMoney(n, country?.code || "NG");

  return (
    <AppShell hideNav>
      <PageHeader
        title="Rent Email"
        subtitle="Temporary inboxes for OTP & sign-ups · HeroSMS"
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-8"
            >
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-oryno-orange-muted text-[var(--oryno-success)]">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h2 className="mt-4 text-xl font-bold sm:text-2xl">
                  Email reserved
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Copy the address and watch for codes · {receipt}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <CopyRow label="Email address" value={email} />
                <CopyRow
                  label="Code / message"
                  value={
                    code ||
                    message ||
                    (polling ? "Waiting for email…" : "—")
                  }
                  mono={!code && !message}
                />
                {polling && !code ? (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Checking HeroSMS inbox…
                  </p>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setEmail("");
                    setEmailId("");
                    setCode(null);
                  }}
                  className="btn-primary h-12 w-full px-6 sm:w-auto"
                >
                  Rent another email
                </button>
                <a
                  href="/dashboard"
                  className="btn-secondary inline-flex h-12 w-full items-center justify-center px-6 sm:w-auto"
                >
                  Back to Home
                </a>
              </div>
            </motion.div>
          </MotionSection>
        ) : (
          <form
            key="form"
            onSubmit={onSubmit}
            className="space-y-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:space-y-5 sm:pb-0"
          >
            <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold">Where will you use it?</h2>
                  <p className="text-xs text-muted-foreground">
                    Site that needs email verification
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {SITES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSite(s.id)}
                    className={cn(
                      "rounded-full px-3.5 py-2 text-sm font-semibold",
                      site === s.id
                        ? "bg-primary text-white"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {site === "other" ? (
                <input
                  value={customSite}
                  onChange={(e) => setCustomSite(e.target.value)}
                  placeholder="example.com"
                  className="mt-3 h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                />
              ) : null}
            </MotionSection>

            <MotionSection
              delay={0.05}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="mb-3 text-base font-semibold">Email domain</h2>
              <div className="grid gap-2">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-[16px] bg-muted"
                    />
                  ))
                ) : (
                  domains.map((d) => (
                    <button
                      key={d.name}
                      type="button"
                      onClick={() => setDomain(d.name)}
                      className={cn(
                        "flex items-center justify-between rounded-[16px] border px-4 py-3 text-left",
                        domain === d.name
                          ? "border-primary bg-oryno-orange-muted"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-semibold">
                        <Inbox className="h-4 w-4 text-primary" />@{d.name}
                      </span>
                      <span className="text-sm font-bold text-primary">
                        {money(d.costLocal)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.08}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="text-base font-semibold">Order summary</h2>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Site" value={siteValue || "—"} />
                <Row label="Domain" value={domain ? `@${domain}` : "—"} />
                <Row
                  label="Amount"
                  value={selected ? money(selected.costLocal) : money(0)}
                  accent
                />
                <div className="flex items-center gap-2 border-t border-border pt-3 font-semibold">
                  <Wallet className="h-4 w-4 text-primary" />
                  Pay from wallet · HeroSMS
                </div>
              </div>
            </MotionSection>

            <ServiceInstructions
              service="emails"
              delay={0.12}
              className="mb-20 sm:mb-0"
            />

            {error ? (
              <p className="rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <div className="hidden sm:block">
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileTap={canSubmit ? { scale: 0.985 } : undefined}
                className="btn-primary h-12 w-full max-w-md text-base disabled:opacity-50"
              >
                {submitting
                  ? "Reserving…"
                  : selected
                    ? `Rent email · ${money(selected.costLocal)}`
                    : "Continue"}
              </motion.button>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-[image:var(--header-surface)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary h-12 w-full text-base disabled:opacity-50"
              >
                {submitting
                  ? "Reserving…"
                  : selected
                    ? `Rent · ${money(selected.costLocal)}`
                    : "Continue"}
              </button>
            </div>
          </form>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "max-w-[60%] text-right font-semibold break-words",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CopyRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-muted/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={cn(
            "truncate text-sm font-bold",
            mono && "text-muted-foreground",
          )}
        >
          {value}
        </p>
      </div>
      {value && value !== "—" && !value.includes("Waiting") ? (
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(value)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-border bg-background"
          aria-label="Copy"
        >
          <Copy className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
