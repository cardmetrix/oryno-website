"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Check,
  Gift,
  Globe2,
  Heart,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";

type WaitlistStatus = {
  joined: boolean;
  joinedAt: string | null;
};

const DETAILS = [
  {
    icon: Globe2,
    title: "Cross-border gifts",
    body: "Send digital gifts and cards to friends and family in other countries from your ORYNO wallet.",
  },
  {
    icon: Send,
    title: "Instant delivery",
    body: "Recipients get codes and gift links by email or in-app - no shipping delays.",
  },
  {
    icon: Heart,
    title: "Curated brands",
    body: "Amazon, Apple, streaming, gaming and lifestyle brands popular worldwide.",
  },
];

export default function InternationalGiftingPage() {
  const [status, setStatus] = useState<WaitlistStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/waitlist/international-gifting", {
        cache: "no-store",
      });
      const json = (await res.json()) as WaitlistStatus & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load waitlist");
      setStatus(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onJoin() {
    setJoining(true);
    try {
      const res = await fetch("/api/waitlist/international-gifting", {
        method: "POST",
      });
      const json = (await res.json()) as {
        error?: string;
        created?: boolean;
      };
      if (!res.ok) throw new Error(json.error || "Could not join waitlist");
      toast.success(
        json.created
          ? "You're on the waitlist"
          : "You're already on the waitlist",
        {
          description: "We'll notify you by email and push when gifting launches.",
        },
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not join");
    } finally {
      setJoining(false);
    }
  }

  async function onLeave() {
    setJoining(true);
    try {
      const res = await fetch("/api/waitlist/international-gifting", {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not leave waitlist");
      toast.success("Removed from waitlist");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not leave");
    } finally {
      setJoining(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="International Gifting"
        subtitle="Send gifts worldwide"
        backHref="/services"
      />

      {loading || !status ? (
        <div className="space-y-4">
          <Skeleton className="h-52 w-full rounded-[22px]" />
          <Skeleton className="h-40 w-full rounded-[22px]" />
        </div>
      ) : (
        <>
          <MotionSection className="mb-4">
            <div className="relative isolate overflow-hidden rounded-[22px] bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] text-white shadow-[var(--shadow-soft)]">
              <motion.div
                aria-hidden
                animate={{ x: ["-40%", "140%"] }}
                transition={{
                  duration: 5.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 2,
                }}
                className="pointer-events-none absolute inset-y-0 z-[1] w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/20 to-transparent"
              />
              <div className="relative z-[2] flex flex-col gap-4 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold tracking-[0.2em] text-white/90 uppercase">
                    ORYNO
                  </p>
                  <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[9px] font-bold tracking-wide ring-1 ring-white/25">
                    COMING SOON
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                    <Gift className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xl font-bold tracking-tight sm:text-2xl">
                      International Gifting
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/85">
                      Send digital gifts and gift cards across borders. Join the
                      waitlist and we will notify you the moment it launches.
                    </p>
                  </div>
                </div>

                {status.joined ? (
                  <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0" />
                      <p className="text-sm font-semibold">
                        You are on the waitlist
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-white/75">
                      {status.joinedAt
                        ? `Joined ${new Date(status.joinedAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}. `
                        : ""}
                      We will email and push you when International Gifting goes
                      live.
                    </p>
                    <button
                      type="button"
                      disabled={joining}
                      onClick={() => void onLeave()}
                      className="mt-3 text-[11px] font-semibold underline-offset-2 opacity-80 hover:underline disabled:opacity-50"
                    >
                      Leave waitlist
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={joining}
                    onClick={() => void onJoin()}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-[#e85d00] transition hover:bg-white/95 disabled:opacity-50"
                  >
                    {joining ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                    Join waitlist
                  </button>
                )}
              </div>
            </div>
          </MotionSection>

          <MotionSection
            delay={0.06}
            className="mb-4 space-y-3 rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
          >
            <p className="text-sm font-semibold">What you will get</p>
            {DETAILS.map((item) => (
              <div key={item.title} className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </MotionSection>
        </>
      )}
    </AppShell>
  );
}
