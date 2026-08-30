"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Inbox,
  Mail,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceSuccess } from "@/components/app/service-success";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { ServiceInstructions } from "@/components/app/service-instructions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { formatUsd } from "@/lib/country";
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
  const isMobile = useIsMobile();
  const { canAffordUsd, frozen } = useWalletBalance();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [domainOpen, setDomainOpen] = useState(false);
  const [domainQuery, setDomainQuery] = useState("");
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

  const filteredDomains = useMemo(() => {
    const q = domainQuery.trim().toLowerCase().replace(/^@/, "");
    if (!q) return domains;
    return domains.filter((d) => d.name.toLowerCase().includes(q));
  }, [domains, domainQuery]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        domain &&
          siteValue &&
          selected &&
          !submitting &&
          !frozen &&
          canAffordUsd(selected.costUsd),
      ),
    [domain, siteValue, selected, submitting, frozen, canAffordUsd],
  );

  useEffect(() => {
    let cancelled = false;
    const siteForDomains = siteValue.trim().toLowerCase();

    if (!siteForDomains) {
      setDomains([]);
      setDomain("");
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setDomains([]);
      setDomain("");
      setDomainOpen(false);
      setDomainQuery("");
      try {
        const res = await fetch(
          `/api/herosms/emails/domains?site=${encodeURIComponent(siteForDomains)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load domains");
        if (cancelled) return;
        const list = (data.domains ?? []) as Domain[];
        setDomains(list);
        if (list[0]?.name) setDomain(list[0].name);
      } catch (e) {
        if (!cancelled) {
          setDomains([]);
          setError(e instanceof Error ? e.message : "Failed to load domains");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, site === "other" ? 400 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [siteValue, site]);

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
      if (!res.ok) {
        console.error("[rent-email] purchase failed", {
          status: res.status,
          code: data.code,
          error: data.error,
        });
        throw new Error(data.error || "Purchase failed");
      }
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

  const money = (n: number) => formatUsd(n);

  return (
    <AppShell hideNav>
      <PageHeader
        title="Rent Email"
        subtitle="Temporary inboxes for OTP & sign-ups · billed in USD"
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <ServiceSuccess
              title="Email reserved!"
              subtitle="Copy the address and watch for codes."
              amountLabel="Amount charged"
              amount={receipt}
              onDismiss={() => setSuccess(false)}
              secondaryAction={{
                label: "Back to Home",
                href: "/dashboard",
                icon: "home",
              }}
              tertiaryAction={{
                label: "Rent another email",
                onClick: () => {
                  setSuccess(false);
                  setEmail("");
                  setEmailId("");
                  setCode(null);
                },
                icon: "plus",
              }}
            >
              <div className="space-y-3">
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
                    Checking inbox for codes…
                  </p>
                ) : null}
              </div>
            </ServiceSuccess>
          </MotionSection>
        ) : (
          <form
            key="form"
            onSubmit={onSubmit}
            className="space-y-4 sm:space-y-5"
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
              <h2 className="mb-1 text-base font-semibold">Email domain</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Search and pick a domain for {siteValue || "your site"}
              </p>

              {loading ? (
                <div className="h-12 animate-pulse rounded-[14px] bg-muted" />
              ) : (
                <button
                  type="button"
                  disabled={!domains.length}
                  onClick={() => {
                    setDomainQuery("");
                    setDomainOpen(true);
                  }}
                  className={cn(
                    "flex h-12 w-full items-center gap-2 rounded-[14px] border border-border bg-background px-3.5 text-left outline-none transition hover:bg-muted/40 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  <Inbox className="h-4 w-4 shrink-0 text-primary" />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm font-semibold",
                      selected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {selected
                      ? `@${selected.name}`
                      : domains.length
                        ? "Select a domain"
                        : siteValue
                          ? "No domains in stock"
                          : "Enter a site first"}
                  </span>
                  {selected ? (
                    <span className="shrink-0 text-sm font-bold text-primary">
                      {money(selected.costUsd)}
                    </span>
                  ) : null}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )}

              {!loading && !domains.length && siteValue ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No domains in stock for {siteValue}. Try another site.
                </p>
              ) : null}

              <DomainPickerSheet
                open={domainOpen}
                onOpenChange={setDomainOpen}
                isMobile={isMobile}
                query={domainQuery}
                onQueryChange={setDomainQuery}
                options={filteredDomains}
                value={domain}
                formatPrice={money}
                onSelect={(name) => {
                  setDomain(name);
                  setDomainOpen(false);
                  setDomainQuery("");
                }}
              />
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
                  value={selected ? money(selected.costUsd) : money(0)}
                  accent
                />
                <div className="flex items-center gap-2 border-t border-border pt-3 font-semibold">
                  <Wallet className="h-4 w-4 text-primary" />
                  Pay from USD card
                </div>
              </div>
            </MotionSection>

            {/* Desktop: clear gap between instructions and rent button */}
            <div className="hidden pt-4 sm:block">
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileTap={canSubmit ? { scale: 0.985 } : undefined}
                className="btn-primary h-12 w-full max-w-md text-base disabled:opacity-50"
              >
                {submitting
                  ? "Reserving…"
                  : frozen
                    ? "Wallet unavailable"
                    : selected && !canAffordUsd(selected.costUsd)
                      ? "Insufficient USD balance"
                      : selected
                        ? `Rent email · ${money(selected.costUsd)}`
                        : "Continue"}
              </motion.button>
            </div>

            {/* Mobile: space = visual gap + sticky CTA height */}
            <div
              aria-hidden
              className="h-[calc(1.5rem+5.5rem+env(safe-area-inset-bottom))] sm:hidden"
            />

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-[image:var(--header-surface)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary h-12 w-full text-base disabled:opacity-50"
              >
                {submitting
                  ? "Reserving…"
                  : frozen
                    ? "Wallet unavailable"
                    : selected && !canAffordUsd(selected.costUsd)
                      ? "Insufficient USD balance"
                      : selected
                        ? `Rent · ${money(selected.costUsd)}`
                        : "Continue"}
              </button>
            </div>
          </form>
        )}
      </AnimatePresence>

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Rent Email"
      />
    </AppShell>
  );
}

function DomainPickerSheet({
  open,
  onOpenChange,
  isMobile,
  query,
  onQueryChange,
  options,
  value,
  formatPrice,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  options: Domain[];
  value: string;
  formatPrice: (n: number) => string;
  onSelect: (name: string) => void;
}) {
  const search = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search domains…"
        className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-base outline-none focus:border-primary"
        autoFocus
      />
    </div>
  );

  const list = options.length ? (
    options.map((d) => {
      const active = d.name === value;
      return (
        <button
          key={d.name}
          type="button"
          onClick={() => onSelect(d.name)}
          className={cn(
            "flex min-h-[56px] w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-muted/70 hover:bg-muted/50",
            active && "bg-oryno-orange-muted",
          )}
        >
          <Inbox className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              @{d.name}
            </p>
            {d.count > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {d.count.toLocaleString()} in stock
              </p>
            ) : null}
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
            {formatPrice(d.costUsd)}
          </span>
          {active ? (
            <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
          ) : (
            <span className="h-4 w-4 shrink-0" />
          )}
        </button>
      );
    })
  ) : (
    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
      {query.trim()
        ? "No domains match your search"
        : "No domains available for this site"}
    </p>
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        shouldScaleBackground={false}
        repositionInputs={false}
        handleOnly
      >
        <DrawerContent className="h-[min(78dvh,640px)] max-h-[78dvh] w-full max-w-full rounded-t-[28px] border-border sm:mx-auto sm:max-w-lg">
          <DrawerHeader className="shrink-0 gap-1 border-b border-border px-4 pb-3 pt-1 text-left sm:px-5">
            <DrawerTitle className="text-base sm:text-lg">
              Select domain
            </DrawerTitle>
            <DrawerDescription className="text-xs sm:text-sm">
              Search and choose an email domain
            </DrawerDescription>
          </DrawerHeader>
          <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
            {search}
          </div>
          <div
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
            data-vaul-no-drag=""
          >
            <div className="pb-4">{list}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden rounded-[24px] p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>Select domain</DialogTitle>
          <DialogDescription>
            Search and choose an email domain
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-border px-4 py-3">{search}</div>
        <div className="max-h-[50vh] overflow-y-auto">{list}</div>
      </DialogContent>
    </Dialog>
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
