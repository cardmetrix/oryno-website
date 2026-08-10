"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Copy,
  Gift,
  Share2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { cn } from "@/lib/utils";

type ReferralsPayload = {
  program: {
    bonusNgn: number;
    bonusLabel: string;
    minTransactions: number;
    description: string;
  };
  code: {
    code: string;
    status: string;
    joinsCount: number;
    earnings: string;
    earningsLabel: string;
    shareUrl: string;
  };
  stats: { joins: number; pending: number; completed: number };
  invites: Array<{
    id: string;
    name: string;
    status: string;
    rewardAmount: string;
    currency: string;
    createdAt: string | null;
  }>;
  asReferred: {
    txCount: number;
    required: number;
    status: string;
    remaining: number;
  } | null;
};

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyCode, setApplyCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/referrals", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as ReferralsPayload;
      setData(json);
    } catch {
      toast.error("Could not load referrals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function copy(text: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === "code" ? "Code copied" : "Link copied");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function share() {
    if (!data) return;
    const text = `Join ORYNO with my code ${data.code.code} and we both earn ${data.program.bonusLabel} after ${data.program.minTransactions} transactions. ${data.code.shareUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join ORYNO",
          text,
          url: data.code.shareUrl,
        });
        return;
      } catch {
        // fall through
      }
    }
    await copy(text, "link");
  }

  async function applyReferral() {
    setApplying(true);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: applyCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success(json.message || "Referral linked");
      setApplyCode("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply code");
    } finally {
      setApplying(false);
    }
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Refer & Earn"
        subtitle="Invite friends and earn when they transact"
        backHref="/profile"
      />

      {loading || !data ? (
        <MotionSection className="space-y-3 rounded-[28px] border border-border bg-background p-5">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </MotionSection>
      ) : (
        <>
          <MotionSection className="overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] p-5 text-white shadow-[0_16px_40px_rgba(255,106,0,0.28)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
                <Gift className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-bold tracking-[0.16em] text-white/75 uppercase">
                  Referral bonus
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">
                  {data.program.bonusLabel} each
                </h2>
                <p className="mt-2 text-sm text-white/85">
                  {data.program.description}
                </p>
              </div>
            </div>
          </MotionSection>

          <MotionSection
            delay={0.04}
            className="mt-4 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Your code
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="font-mono text-2xl font-bold tracking-wide text-foreground">
                {data.code.code}
              </p>
              <button
                type="button"
                onClick={() => void copy(data.code.code, "code")}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold"
              >
                {copied === "code" ? (
                  <Check className="h-3.5 w-3.5 text-[var(--oryno-success)]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy
              </button>
            </div>

            <p className="mt-4 break-all rounded-2xl border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              {data.code.shareUrl}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => void copy(data.code.shareUrl, "link")}
                className="btn-secondary inline-flex h-11 items-center justify-center gap-2 text-sm"
              >
                <Copy className="h-4 w-4" />
                Copy link
              </button>
              <button
                type="button"
                onClick={() => void share()}
                className="btn-primary inline-flex h-11 items-center justify-center gap-2 text-sm"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: "Joins", value: data.stats.joins },
                { label: "Pending", value: data.stats.pending },
                { label: "Paid", value: data.stats.completed },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-border bg-muted/40 px-3 py-3 text-center"
                >
                  <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                    {s.label}
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>

            <p className="mt-3 text-sm text-muted-foreground">
              Earnings ·{" "}
              <span className="font-semibold text-foreground">
                {data.code.earningsLabel}
              </span>
            </p>
          </MotionSection>

          {data.asReferred ? (
            <MotionSection
              delay={0.06}
              className="mt-4 rounded-[28px] border border-border bg-background p-5"
            >
              <p className="text-sm font-bold text-foreground">
                Your invite progress
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.asReferred.status === "completed"
                  ? "Bonus already paid — thanks for joining with a referral."
                  : `${data.asReferred.txCount} of ${data.asReferred.required} transactions completed. ${data.asReferred.remaining} left to unlock your bonus.`}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(
                      100,
                      (data.asReferred.txCount / data.asReferred.required) *
                        100,
                    )}%`,
                  }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
            </MotionSection>
          ) : (
            <MotionSection
              delay={0.06}
              className="mt-4 space-y-3 rounded-[28px] border border-border bg-background p-5"
            >
              <p className="text-sm font-bold text-foreground">
                Have a referral code?
              </p>
              <AuthField label="Enter code">
                <input
                  value={applyCode}
                  onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                  placeholder="ORYXXXX"
                  className={authInputClassName}
                />
              </AuthField>
              <button
                type="button"
                disabled={applying || !applyCode.trim()}
                onClick={() => void applyReferral()}
                className="btn-primary h-11 w-full text-sm disabled:opacity-60"
              >
                {applying ? "Applying…" : "Apply code"}
              </button>
            </MotionSection>
          )}

          <MotionSection delay={0.08} className="mt-4 mb-6 space-y-2">
            <div className="mb-2 flex items-center gap-2 px-0.5">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Your invites</p>
            </div>
            {data.invites.length === 0 ? (
              <p className="rounded-2xl border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                No invites yet. Share your code to get started.
              </p>
            ) : (
              data.invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {invite.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {invite.createdAt
                        ? new Date(invite.createdAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                      invite.status === "completed"
                        ? "bg-[var(--oryno-success)]/15 text-[var(--oryno-success)]"
                        : invite.status === "pending"
                          ? "bg-oryno-orange-muted text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {invite.status}
                  </span>
                </div>
              ))
            )}
          </MotionSection>
        </>
      )}
    </AppShell>
  );
}
