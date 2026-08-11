"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Headphones,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Ticket,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { startLiveSupport } from "@/components/app/crisp-chat";
import {
  SUPPORT_EMAIL,
  SUPPORT_FAQS,
  SUPPORT_PHONE,
  SUPPORT_TOPICS,
} from "@/lib/support/config";
import { isCrispConfigured } from "@/lib/support/crisp";
import { cn } from "@/lib/utils";

type TicketRow = {
  id: string;
  reference: string;
  topic: string;
  subject: string;
  status: string;
  updatedAt: string;
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function SupportPage() {
  const { user } = useUser();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSent, setTicketSent] = useState<string | null>(null);
  const [topic, setTopic] = useState<(typeof SUPPORT_TOPICS)[number]>(
    SUPPORT_TOPICS[0],
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  useEffect(() => {
    const fromClerk = user?.primaryEmailAddress?.emailAddress;
    if (fromClerk) setEmail(fromClerk);
  }, [user?.primaryEmailAddress?.emailAddress]);

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/support/tickets", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { tickets?: TicketRow[] };
      setTickets(json.tickets ?? []);
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  function openChat() {
    if (isCrispConfigured()) {
      startLiveSupport();
      return;
    }
    setTicketOpen(true);
    setTopic("Other");
  }

  async function submitTicket(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, email, message }),
      });
      const json = (await res.json()) as {
        error?: string;
        ticket?: { reference: string };
      };
      if (!res.ok) throw new Error(json.error || "Could not submit ticket");
      setTicketSent(json.ticket?.reference || "ORY");
      setTicketOpen(false);
      setMessage("");
      await loadTickets();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not submit ticket");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Help & Support"
        subtitle="Live chat, tickets, and FAQs"
        backHref="/settings"
      />

      <MotionSection className="relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-oryno-orange to-oryno-orange-soft p-6 text-white shadow-[var(--shadow-orange-lg)] sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-white/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/18 ring-1 ring-white/25 backdrop-blur-md">
              <Headphones className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-semibold text-white/85">
                ORYNO Support
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                We’re here to help
              </h2>
              <p className="mt-1 text-sm text-white/80">
                Live chat with an agent, or open a ticket and we’ll email you.
              </p>
            </div>
          </div>
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={openChat}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-oryno-charcoal px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(28,28,30,0.28)]"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2} />
            Start Live Chat
          </motion.button>
        </div>
      </MotionSection>

      <MotionSection delay={0.06} className="mt-5 grid gap-3 sm:grid-cols-3">
        <ActionCard
          icon={MessageCircle}
          title="Live Chat"
          subtitle={isCrispConfigured() ? "Chat with an agent" : "Opens a ticket"}
          onClick={openChat}
        />
        <ActionCard
          icon={Ticket}
          title="New Ticket"
          subtitle="Trackable support request"
          onClick={() => {
            setTicketOpen(true);
            setTicketSent(null);
          }}
        />
        <ActionCard
          icon={Mail}
          title="Email us"
          subtitle={SUPPORT_EMAIL}
          href={`mailto:${SUPPORT_EMAIL}`}
        />
      </MotionSection>

      <AnimatePresence>
        {ticketOpen ? (
          <MotionSection delay={0.02} className="mt-5">
            <motion.form
              onSubmit={submitTicket}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Create support ticket
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    We’ll email updates as we resolve it
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTicketOpen(false)}
                  className="text-sm font-semibold text-primary"
                >
                  Cancel
                </button>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-foreground">Topic</span>
                <select
                  value={topic}
                  onChange={(e) =>
                    setTopic(e.target.value as (typeof SUPPORT_TOPICS)[number])
                  }
                  className="mt-2 h-12 w-full rounded-[14px] border border-border bg-muted/40 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  {SUPPORT_TOPICS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block">
                <span className="text-sm font-semibold text-foreground">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-2 h-12 w-full rounded-[14px] border border-border bg-muted/40 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-sm font-semibold text-foreground">
                  How can we help?
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  placeholder="Describe the issue, including transaction IDs if you have them…"
                  className="mt-2 w-full resize-none rounded-[14px] border border-border bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              {formError ? (
                <p className="mt-3 text-sm font-medium text-destructive">{formError}</p>
              ) : null}

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                className="btn-primary mt-5 inline-flex h-12 w-full items-center justify-center gap-2 text-base disabled:opacity-60 sm:max-w-xs"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit ticket
              </motion.button>
            </motion.form>
          </MotionSection>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {ticketSent ? (
          <MotionSection delay={0.02} className="mt-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-start gap-3 rounded-[20px] border border-border bg-background px-4 py-4 shadow-[var(--shadow-soft)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-oryno-orange-muted text-[var(--oryno-success)]">
                <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Ticket submitted
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Reference{" "}
                  <span className="font-semibold text-primary">{ticketSent}</span>{" "}
                  — we’ll update you by email.
                </p>
              </div>
            </motion.div>
          </MotionSection>
        ) : null}
      </AnimatePresence>

      <MotionSection
        delay={0.1}
        className="mt-5 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Your tickets</h3>
          <span className="text-xs font-medium text-muted-foreground">
            Latest
          </span>
        </div>
        {loadingTickets ? (
          <p className="text-sm text-muted-foreground">Loading tickets…</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tickets yet. Open one above or start live chat.
          </p>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket, index) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + index * 0.03 }}
                className="flex items-center justify-between gap-3 rounded-[16px] border border-border/80 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {ticket.subject}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ticket.reference} · {timeAgo(ticket.updatedAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    ticket.status === "resolved" || ticket.status === "closed"
                      ? "bg-muted text-[var(--oryno-success)]"
                      : "bg-oryno-orange-muted text-primary",
                  )}
                >
                  <Clock3 className="h-3 w-3" />
                  {statusLabel(ticket.status)}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </MotionSection>

      <MotionSection
        delay={0.14}
        className="mt-5 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <h3 className="mb-1 text-base font-semibold text-foreground">
          Frequently asked questions
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Quick answers for common ORYNO questions
        </p>
        <div className="divide-y divide-border rounded-[18px] border border-border">
          {SUPPORT_FAQS.map((faq, index) => {
            const open = openFaq === index;
            return (
              <div key={faq.q} className="px-4">
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : index)}
                  className="flex w-full items-center justify-between gap-3 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-foreground">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-180 text-primary",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
                        {faq.a}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </MotionSection>

      <MotionSection
        delay={0.18}
        className="mt-5 mb-2 rounded-[28px] border border-border bg-muted/40 p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-primary shadow-[var(--shadow-soft)]">
              {SUPPORT_PHONE ? (
                <Phone className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Mail className="h-5 w-5" strokeWidth={1.75} />
              )}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Still need help?
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {SUPPORT_PHONE
                  ? `Call ${SUPPORT_PHONE} · or email ${SUPPORT_EMAIL}`
                  : `Email ${SUPPORT_EMAIL} and we’ll get back to you.`}
              </p>
            </div>
          </div>
          <motion.a
            href={SUPPORT_PHONE ? `tel:${SUPPORT_PHONE}` : `mailto:${SUPPORT_EMAIL}`}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary inline-flex h-11 items-center justify-center px-5 text-sm"
          >
            {SUPPORT_PHONE ? "Call support" : "Email support"}
          </motion.a>
        </div>
      </MotionSection>
    </AppShell>
  );
}

function ActionCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
  href,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "flex w-full items-center gap-3 rounded-[20px] border border-border bg-background p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-primary/30 hover:bg-oryno-orange-muted/40";

  const body = (
    <>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <motion.a href={href} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} className={className}>
        {body}
      </motion.a>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={className}
    >
      {body}
    </motion.button>
  );
}
