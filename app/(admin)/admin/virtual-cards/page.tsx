"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
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
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { cn } from "@/lib/utils";

type OrderRow = {
  id: string;
  status:
    | "pending_payment"
    | "paid_pending_review"
    | "approved"
    | "rejected"
    | "issued";
  feeFormatted: string;
  localFormatted: string;
  localCurrency: string;
  paymentRef: string | null;
  paidAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    countryCode: string | null;
  };
};

const STATUS_LABEL: Record<OrderRow["status"], string> = {
  pending_payment: "Pending payment",
  paid_pending_review: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
  issued: "Issued",
};

export default function AdminVirtualCardsPage() {
  const { data, loading, error, reload } = useAdminQuery<{
    pendingCount: number;
    orders: OrderRow[];
  }>("/api/admin/virtual-cards");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const orders = useMemo(() => {
    const list = data?.orders ?? [];
    if (filter === "pending") {
      return list.filter((o) => o.status === "paid_pending_review");
    }
    return list;
  }, [data?.orders, filter]);

  async function review(
    orderId: string,
    action: "approve" | "reject",
  ) {
    setBusyId(orderId);
    try {
      const res = await fetch("/api/admin/virtual-cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          action,
          note: noteById[orderId]?.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast.success(
        action === "approve" ? "Card issued to user" : "Purchase rejected",
      );
      setNoteById((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Virtual card purchases"
        subtitle="Review Flutterwave-paid USD virtual card orders and issue cards"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Awaiting review"
          value={String(data?.pendingCount ?? 0)}
        />
        <StatCard
          label="Orders loaded"
          value={String(data?.orders?.length ?? 0)}
          delay={0.04}
        />
        <StatCard label="Filter" value={filter === "pending" ? "Pending" : "All"} delay={0.08} />
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
            filter === "pending"
              ? "bg-primary text-primary-foreground ring-primary"
              : "bg-muted text-muted-foreground ring-border",
          )}
        >
          Pending review
        </button>
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
            filter === "all"
              ? "bg-primary text-primary-foreground ring-primary"
              : "bg-muted text-muted-foreground ring-border",
          )}
        >
          All orders
        </button>
      </div>

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {!loading && !error && orders.length === 0 ? (
          <AdminEmptyBlock
            message={
              filter === "pending"
                ? "No paid card purchases awaiting review."
                : "No virtual card orders yet."
            }
          />
        ) : null}
        {!loading && !error && orders.length > 0 ? (
          <AdminTable
            rows={orders}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "user",
                header: "User",
                cell: (row) => (
                  <div>
                    <p className="font-semibold">{row.user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.user.email}
                    </p>
                    {row.user.countryCode ? (
                      <p className="text-[11px] text-muted-foreground">
                        {row.user.countryCode}
                      </p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "amount",
                header: "Paid",
                cell: (row) => (
                  <div>
                    <p className="font-semibold">{row.localFormatted}</p>
                    <p className="text-xs text-muted-foreground">
                      Fee {row.feeFormatted}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => (
                  <StatusBadge
                    status={
                      row.status === "paid_pending_review"
                        ? "Pending"
                        : row.status === "issued"
                          ? "Approved"
                          : row.status === "rejected"
                            ? "Rejected"
                            : STATUS_LABEL[row.status]
                    }
                  />
                ),
              },
              {
                key: "paid",
                header: "Paid at",
                hideOnMobile: true,
                cell: (row) =>
                  row.paidAt
                    ? new Date(row.paidAt).toLocaleString("en-NG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—",
              },
              {
                key: "ref",
                header: "Reference",
                hideOnMobile: true,
                cell: (row) => (
                  <span className="font-mono text-[11px]">
                    {row.paymentRef || "—"}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "Review",
                cell: (row) => {
                  if (row.status !== "paid_pending_review") {
                    return (
                      <p className="max-w-[160px] text-xs text-muted-foreground">
                        {row.reviewNote || STATUS_LABEL[row.status]}
                      </p>
                    );
                  }
                  const busy = busyId === row.id;
                  return (
                    <div className="flex min-w-[200px] flex-col gap-2">
                      <input
                        value={noteById[row.id] ?? ""}
                        onChange={(e) =>
                          setNoteById((prev) => ({
                            ...prev,
                            [row.id]: e.target.value,
                          }))
                        }
                        placeholder="Optional note"
                        className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                        disabled={busy}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void review(row.id, "approve")}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--oryno-success)]/15 px-2 text-xs font-semibold text-[var(--oryno-success)] disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Issue
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void review(row.id, "reject")}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--oryno-error)]/15 px-2 text-xs font-semibold text-[var(--oryno-error)] disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                },
              },
            ]}
          />
        ) : null}
      </AdminCard>
    </>
  );
}
