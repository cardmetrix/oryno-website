"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
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
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { cn } from "@/lib/utils";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string;
  status: string;
  statusLabel: string;
  kyc: string;
  kycLabel: string;
  balance: string;
  balances: Array<{
    balanceFormatted: string;
    currency: string;
    status: string;
    isPrimary: boolean;
  }>;
};

type UserDetail = {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    username: string | null;
    country: string;
    countryCode: string | null;
    status: string;
    statusLabel: string;
    kyc: string;
    kycLabel: string;
    lastLoginAt: string | null;
    createdAt: string | null;
  };
  wallets: Array<{
    id: string;
    currency: string;
    balanceFormatted: string;
    status: string;
    statusLabel: string;
    isPrimary: boolean;
  }>;
  kycSubmission: {
    id: string;
    status: string;
    statusLabel: string;
    idType: string | null;
    idNumber: string | null;
    idFrontUrl: string | null;
    idBackUrl: string | null;
    selfieUrl: string | null;
    rejectionReason: string | null;
  } | null;
  transactions: Array<{
    id: string;
    title: string;
    amount: string;
    status: string;
    category: string;
    when: string;
  }>;
};

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [kycFilter, setKycFilter] = useState("");
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (kycFilter) params.set("kyc", kycFilter);
    const qs = params.toString();
    return `/api/admin/users${qs ? `?${qs}` : ""}`;
  }, [q, statusFilter, kycFilter]);

  const { data, loading, error, reload } = useAdminQuery<{ users: UserRow[] }>(
    url,
  );
  const [manageId, setManageId] = useState<string | null>(null);

  return (
    <>
      <AdminPageHeader
        title="Users"
        subtitle="Balances, KYC, suspend / activate, and wallet controls"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search users…"
                className="h-11 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-52"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 w-full rounded-[14px] border border-border bg-background px-3 text-sm sm:w-auto"
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="deleted">Deleted</option>
              </select>
              <select
                value={kycFilter}
                onChange={(e) => setKycFilter(e.target.value)}
                className="h-11 w-full rounded-[14px] border border-border bg-background px-3 text-sm sm:w-auto"
              >
                <option value="">All KYC</option>
                <option value="unverified">Unverified</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        }
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock variant="table" rows={8} /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {!loading && !error && data ? (
          data.users.length === 0 ? (
            <AdminEmptyBlock message="No users found." />
          ) : (
            <AdminTable
              rows={data.users}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "User",
                  cell: (row) => (
                    <div>
                      <p className="font-semibold text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </div>
                  ),
                },
                {
                  key: "country",
                  header: "Country",
                  cell: (row) => (
                    <span className="text-foreground">{row.country}</span>
                  ),
                },
                {
                  key: "kyc",
                  header: "KYC",
                  cell: (row) => <StatusBadge status={row.kycLabel} />,
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (row) => <StatusBadge status={row.statusLabel} />,
                },
                {
                  key: "balance",
                  header: "Balance",
                  cell: (row) => (
                    <div>
                      <p className="font-semibold text-foreground">
                        {row.balance}
                      </p>
                      {row.balances.length > 1 ? (
                        <p className="text-[10px] text-muted-foreground">
                          {row.balances.length} wallets
                        </p>
                      ) : null}
                    </div>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  cell: (row) => (
                    <button
                      type="button"
                      onClick={() => setManageId(row.id)}
                      className="text-sm font-semibold text-primary"
                    >
                      Manage
                    </button>
                  ),
                },
              ]}
            />
          )
        ) : null}
      </AdminCard>

      <UserManageSheet
        userId={manageId}
        onClose={() => setManageId(null)}
        onChanged={reload}
      />
    </>
  );
}

function UserManageSheet({
  userId,
  onClose,
  onChanged,
}: {
  userId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const isMobile = useIsMobile();
  const open = Boolean(userId);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!userId) {
      setDetail(null);
      setNote("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load user");
        if (!cancelled) setDetail(json as UserDetail);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load user");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // intentionally only reload when userId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function patch(body: Record<string, unknown>, success: string) {
    if (!userId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, note: note || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast.success(success);
      const refreshed = await fetch(`/api/admin/users/${userId}`, {
        cache: "no-store",
      });
      const data = await refreshed.json();
      if (refreshed.ok) setDetail(data as UserDetail);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <div className="space-y-5 px-1 pb-6">
      {loading || !detail ? (
        <AdminLoadingBlock variant="settings" />
      ) : (
        <>
          <div>
            <p className="text-lg font-bold text-foreground">
              {detail.user.name}
            </p>
            <p className="text-sm text-muted-foreground">{detail.user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusBadge status={detail.user.statusLabel} />
              <StatusBadge status={detail.user.kycLabel} />
              <span className="text-xs text-muted-foreground">
                {detail.user.country}
              </span>
            </div>
          </div>

          <section className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Balances
            </p>
            {detail.wallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wallets</p>
            ) : (
              <div className="space-y-2">
                {detail.wallets.map((w) => (
                  <div
                    key={w.id}
                    className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {w.balanceFormatted}
                        {w.isPrimary ? (
                          <span className="ml-2 text-[10px] text-primary">
                            Primary
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {w.currency} · {w.statusLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={busy || w.status === "frozen"}
                        onClick={() =>
                          void patch(
                            { walletId: w.id, walletStatus: "frozen" },
                            `${w.currency} wallet frozen`,
                          )
                        }
                        className="flex-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold disabled:opacity-50 sm:flex-none"
                      >
                        Freeze
                      </button>
                      <button
                        type="button"
                        disabled={busy || w.status === "healthy"}
                        onClick={() =>
                          void patch(
                            { walletId: w.id, walletStatus: "healthy" },
                            `${w.currency} wallet unfrozen`,
                          )
                        }
                        className="flex-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold disabled:opacity-50 sm:flex-none"
                      >
                        Unfreeze
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Account status
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ActionBtn
                disabled={busy || detail.user.status === "active"}
                onClick={() =>
                  void patch({ status: "active" }, "User activated")
                }
                label="Activate"
                primary={detail.user.status === "active"}
              />
              <ActionBtn
                disabled={busy || detail.user.status === "suspended"}
                onClick={() =>
                  void patch({ status: "suspended" }, "User suspended")
                }
                label="Suspend"
                danger
              />
              <ActionBtn
                disabled={busy}
                onClick={() =>
                  void patch({ freezeAllWallets: true }, "All wallets frozen")
                }
                label="Freeze wallets"
              />
              <ActionBtn
                disabled={busy}
                onClick={() =>
                  void patch(
                    { unfreezeAllWallets: true },
                    "All wallets unfrozen",
                  )
                }
                label="Unfreeze wallets"
              />
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              KYC
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ActionBtn
                disabled={busy || detail.user.kyc === "verified"}
                onClick={() =>
                  void patch({ kycStatus: "verified" }, "KYC verified")
                }
                label="Verify KYC"
                primary
              />
              <ActionBtn
                disabled={busy || detail.user.kyc === "rejected"}
                onClick={() =>
                  void patch({ kycStatus: "rejected" }, "KYC rejected")
                }
                label="Reject KYC"
                danger
              />
              <ActionBtn
                disabled={busy || detail.user.kyc === "pending"}
                onClick={() =>
                  void patch({ kycStatus: "pending" }, "KYC set to pending")
                }
                label="Mark pending"
              />
              <ActionBtn
                disabled={busy || detail.user.kyc === "unverified"}
                onClick={() =>
                  void patch(
                    { kycStatus: "unverified" },
                    "KYC reset to unverified",
                  )
                }
                label="Reset KYC"
              />
            </div>
            {detail.kycSubmission ? (
              <div className="rounded-xl border border-border p-3 text-xs text-muted-foreground">
                <p>
                  Submission: {detail.kycSubmission.statusLabel}
                  {detail.kycSubmission.idType
                    ? ` · ${detail.kycSubmission.idType}`
                    : ""}
                </p>
                {detail.kycSubmission.idNumber ? (
                  <p className="mt-1">ID: {detail.kycSubmission.idNumber}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.kycSubmission.idFrontUrl ? (
                    <a
                      href={detail.kycSubmission.idFrontUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-primary"
                    >
                      Front ID
                    </a>
                  ) : null}
                  {detail.kycSubmission.idBackUrl ? (
                    <a
                      href={detail.kycSubmission.idBackUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-primary"
                    >
                      Back ID
                    </a>
                  ) : null}
                  {detail.kycSubmission.selfieUrl ? (
                    <a
                      href={detail.kycSubmission.selfieUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-primary"
                    >
                      Selfie
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              Note / rejection reason
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Optional note sent with suspend / KYC reject…"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <section className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recent transactions
            </p>
            {detail.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {detail.transactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border/80 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.category} · {t.when}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{t.amount}</p>
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
        <DrawerContent className="flex max-h-[92svh] flex-col px-4">
          <DrawerHeader className="shrink-0 px-0 text-left">
            <DrawerTitle>Manage user</DrawerTitle>
            <DrawerDescription>
              Full account, wallet, and KYC controls
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage user</DialogTitle>
          <DialogDescription>
            Full account, wallet, and KYC controls
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  primary,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-10 rounded-xl text-xs font-semibold transition disabled:opacity-50",
        primary
          ? "bg-primary text-primary-foreground"
          : danger
            ? "border border-[var(--oryno-error)]/40 bg-[var(--oryno-error)]/10 text-[var(--oryno-error)]"
            : "border border-border bg-background text-foreground",
      )}
    >
      {label}
    </motion.button>
  );
}
