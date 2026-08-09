"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { cn } from "@/lib/utils";

type Submission = {
  id: string;
  status: string;
  statusLabel: string;
  targetLevel?: number;
  levelLabel?: string;
  idType: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  rejectionReason: string | null;
  createdAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    country: string;
    kycLevel?: number;
  };
};

export default function AdminKycPage() {
  const [status, setStatus] = useState("pending");
  const url = useMemo(
    () =>
      `/api/admin/kyc${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    [status],
  );
  const { data, loading, error, reload } = useAdminQuery<{
    submissions: Submission[];
    pendingCount: number;
  }>(url);

  const [review, setReview] = useState<Submission | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "reject") {
    if (!review) return;
    if (action === "reject" && !reason.trim()) {
      toast.error("Enter a rejection reason");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/kyc/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update KYC");
      toast.success(action === "approve" ? "KYC approved" : "KYC rejected");
      setReview(null);
      setReason("");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update KYC");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="KYC Management"
        subtitle="Review identity submissions and approve or reject"
        actions={
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 w-full rounded-[14px] border border-border bg-background px-3 text-sm sm:w-auto"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="unverified">Unverified</option>
          </select>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="In this view"
          value={String(data?.submissions.length ?? "—")}
          change={status ? `Filter: ${status}` : "All submissions"}
          up
        />
        <StatCard
          label="Pending (view)"
          value={String(data?.pendingCount ?? "—")}
          change="Needs review"
          up={(data?.pendingCount ?? 0) === 0}
          delay={0.05}
        />
        <StatCard
          label="Queue"
          value="Live"
          change="Synced with user KYC"
          up
          delay={0.1}
        />
      </div>

      <AdminCard>
        {loading ? <AdminLoadingBlock variant="table" /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          data.submissions.length === 0 ? (
            <AdminEmptyBlock message="No KYC submissions for this filter." />
          ) : (
            <AdminTable
              rows={data.submissions}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "user",
                  header: "User",
                  cell: (row) => (
                    <div>
                      <p className="font-semibold text-foreground">
                        {row.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.user.email}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "country",
                  header: "Country",
                  cell: (row) => row.user.country,
                },
                {
                  key: "level",
                  header: "Level",
                  cell: (row) => (
                    <span className="text-sm font-semibold">
                      {row.levelLabel || `Level ${row.targetLevel || 1}`}
                    </span>
                  ),
                },
                {
                  key: "id",
                  header: "Document",
                  cell: (row) => (
                    <span className="text-sm">
                      {row.idType || "—"}
                      {row.idNumber ? ` · ${row.idNumber}` : ""}
                    </span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (row) => <StatusBadge status={row.statusLabel} />,
                },
                {
                  key: "actions",
                  header: "",
                  cell: (row) => (
                    <button
                      type="button"
                      onClick={() => {
                        setReason("");
                        setReview(row);
                      }}
                      className="text-sm font-semibold text-primary"
                    >
                      Review
                    </button>
                  ),
                },
              ]}
            />
          )
        ) : null}
      </AdminCard>

      <Dialog
        open={Boolean(review)}
        onOpenChange={(v) => {
          if (!v) {
            setReview(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Review Level {review?.targetLevel || 1} KYC
            </DialogTitle>
            <DialogDescription>
              {review?.user.name} · {review?.user.email}
            </DialogDescription>
          </DialogHeader>

          {review ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={review.statusLabel} />
                <StatusBadge
                  status={review.levelLabel || `Level ${review.targetLevel || 1}`}
                />
                <span className="text-xs text-muted-foreground">
                  {review.user.country}
                  {typeof review.user.kycLevel === "number"
                    ? ` · current L${review.user.kycLevel}`
                    : ""}
                </span>
              </div>

              <div className="rounded-xl border border-border p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Target level:</span>{" "}
                  {review.targetLevel || 1}
                </p>
                <p className="mt-1">
                  <span className="text-muted-foreground">Document:</span>{" "}
                  {review.idType || "—"}
                </p>
                <p className="mt-1">
                  <span className="text-muted-foreground">Number:</span>{" "}
                  {review.idNumber || "—"}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <DocLink href={review.idFrontUrl} label="Front ID" />
                <DocLink href={review.idBackUrl} label="Back ID" />
                <DocLink href={review.selfieUrl} label="Selfie" />
              </div>

              {review.idFrontUrl || review.selfieUrl ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {review.idFrontUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.idFrontUrl}
                      alt="ID front"
                      className="h-40 w-full rounded-xl border border-border object-cover sm:h-32"
                    />
                  ) : null}
                  {review.selfieUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.selfieUrl}
                      alt="Selfie"
                      className="h-40 w-full rounded-xl border border-border object-cover sm:h-32"
                    />
                  ) : null}
                </div>
              ) : null}

              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">
                  Rejection reason
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Required when rejecting…"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={busy || review.status === "verified"}
                  onClick={() => void act("approve")}
                  className={cn(
                    "btn-primary h-11 text-sm disabled:opacity-50",
                  )}
                >
                  {busy ? "Saving…" : "Approve"}
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={busy || review.status === "rejected"}
                  onClick={() => void act("reject")}
                  className="h-11 rounded-[14px] border border-[var(--oryno-error)]/40 bg-[var(--oryno-error)]/10 text-sm font-semibold text-[var(--oryno-error)] disabled:opacity-50"
                >
                  Reject
                </motion.button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span className="rounded-xl border border-dashed border-border px-2 py-3 text-center text-[11px] text-muted-foreground">
        No {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-xl border border-border px-2 py-3 text-center text-[11px] font-semibold text-primary hover:bg-muted/40"
    >
      Open {label}
    </a>
  );
}
