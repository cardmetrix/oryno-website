"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  Ticket,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "How do I fund my ORYNO wallet?",
    a: "Go to Wallet → Fund, choose card, bank transfer, or USSD, enter an amount, and confirm. Funds usually appear within seconds after a successful payment.",
  },
  {
    q: "Why is my airtime or data purchase delayed?",
    a: "Most top-ups are instant. If a network is slow, your order stays in Processing and you’ll get a notification when it completes or fails with an automatic wallet refund.",
  },
  {
    q: "How do withdrawals work?",
    a: "Withdraw from Wallet → Withdraw. ORYNO detects your country and routes payouts through the correct local bank or mobile money provider. Typical timing is 5–30 minutes.",
  },
  {
    q: "When will gift cards launch?",
    a: "Gift card buy & sell is coming soon. Tap Notify me on the Gift Cards screen to get an alert when it goes live in your country.",
  },
  {
    q: "How do I verify my account (KYC)?",
    a: "Open Settings → KYC Verification and follow the steps. Some features may require KYC depending on your country configuration and transaction limits.",
  },
];

const tickets = [
  {
    id: "ORY-1042",
    subject: "Data bundle not activated",
    status: "In progress",
    updated: "2 hrs ago",
  },
  {
    id: "ORY-0988",
    subject: "Wallet funding confirmation",
    status: "Resolved",
    updated: "Yesterday",
  },
];

const topics = [
  "Wallet & Funding",
  "Airtime / Data",
  "Bill Payments",
  "Virtual Numbers",
  "Rent Email",
  "Account & Security",
  "Other",
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);
  const [topic, setTopic] = useState(topics[0]);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("chidi@oryno.com");

  function submitTicket(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setTicketSent(true);
    setTicketOpen(false);
    setMessage("");
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
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/18 ring-1 ring-white/25 backdrop-blur-md">
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
                Average reply under 10 minutes · 24/7 for urgent wallet issues
              </p>
            </div>
          </div>
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setChatOpen(true);
              setTicketOpen(false);
            }}
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
          subtitle="Chat with an agent"
          onClick={() => {
            setChatOpen(true);
            setTicketOpen(false);
          }}
        />
        <ActionCard
          icon={Ticket}
          title="New Ticket"
          subtitle="Trackable support request"
          onClick={() => {
            setTicketOpen(true);
            setChatOpen(false);
            setTicketSent(false);
          }}
        />
        <ActionCard
          icon={Mail}
          title="Email us"
          subtitle="support@oryno.com"
          href="mailto:support@oryno.com"
        />
      </MotionSection>

      <AnimatePresence>
        {chatOpen ? (
          <MotionSection delay={0.02} className="mt-5">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Live chat
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Agent typically joins in under a minute
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="text-sm font-semibold text-primary"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3 rounded-[18px] bg-muted/50 p-4">
                <ChatBubble
                  from="agent"
                  text="Hi Chidi 👋 Welcome to ORYNO Support. How can we help today?"
                />
                <ChatBubble
                  from="user"
                  text="I need help confirming a wallet funding."
                />
                <ChatBubble
                  from="agent"
                  text="Sure — share the amount and approximate time, and we’ll check it right away."
                />
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  placeholder="Type your message…"
                  className="h-12 flex-1 rounded-[14px] border border-border bg-muted/40 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                <motion.button
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="btn-primary h-12 px-5"
                >
                  Send
                </motion.button>
              </div>
            </motion.div>
          </MotionSection>
        ) : null}
      </AnimatePresence>

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
                <span className="text-sm font-semibold text-foreground">
                  Topic
                </span>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-2 h-12 w-full rounded-[14px] border border-border bg-muted/40 px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  {topics.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block">
                <span className="text-sm font-semibold text-foreground">
                  Email
                </span>
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

              <motion.button
                type="submit"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                className="btn-primary mt-5 h-12 w-full text-base sm:max-w-xs"
              >
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
                  Reference <span className="font-semibold text-primary">ORY-1107</span>{" "}
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
          <h3 className="text-base font-semibold text-foreground">
            Your tickets
          </h3>
          <span className="text-xs font-medium text-muted-foreground">
            Last 30 days
          </span>
        </div>
        <div className="space-y-3">
          {tickets.map((ticket, index) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + index * 0.04 }}
              className="flex items-center justify-between gap-3 rounded-[16px] border border-border/80 px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {ticket.subject}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ticket.id} · Updated {ticket.updated}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  ticket.status === "Resolved"
                    ? "bg-muted text-[var(--oryno-success)]"
                    : "bg-oryno-orange-muted text-primary",
                )}
              >
                <Clock3 className="h-3 w-3" />
                {ticket.status}
              </span>
            </motion.div>
          ))}
        </div>
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
          {faqs.map((faq, index) => {
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
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-primary shadow-[var(--shadow-soft)]">
              <Phone className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Still need help?
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Call +234 800 000 ORYNO · Mon–Sun, 8am–10pm
              </p>
            </div>
          </div>
          <motion.a
            href="tel:+2348000000000"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary inline-flex h-11 items-center justify-center px-5 text-sm"
          >
            Call support
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
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
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

function ChatBubble({
  from,
  text,
}: {
  from: "agent" | "user";
  text: string;
}) {
  const isUser = from === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-[16px] px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-[6px] bg-primary text-white"
            : "rounded-bl-[6px] bg-background text-foreground shadow-[var(--shadow-soft)]",
        )}
      >
        {text}
      </div>
    </div>
  );
}
