"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Search } from "lucide-react";
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

type PinUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  username: string | null;
  countryCode: string | null;
  status: string;
  statusLabel: string;
  hasPin: boolean;
  pin: string | null;
  pinLabel: string;
  failedPinAttempts: number;
  lockedUntil: string | null;
  isLocked: boolean;
  pinUpdatedAt: string | null;
};

type ManageState = {
  user: PinUser;
  action: "set" | "clear" | "unlock";
};

export default function AdminTransactionPinsPage() {
  const [q, setQ] = useState("");
  const [pinFilter, setPinFilter] = useState("");
  const [revealIds, setRevealIds] = useState<Record<string, boolean>>({});
  const [manage, setManage] = useState<ManageState | null>(null);
  const [newPin, setNewPin] = useState("");
  const [notifyUser, setNotifyUser] = useState(true);
  const [saving, setSaving] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (pinFilter) params.set("pin", pinFilter);
    const qs = params.toString();
    return `/api/admin/transaction-pins${qs ? `?${qs}` : ""}`;
  }, [q, pinFilter]);

  const { data, loading, error, reload } = useAdminQuery<{
    users: PinUser[];
    stats: {
      total: number;
      withPin: number;
      withoutPin: number;
      locked: number;
    };
  }>(url);

  async function runAction() {
    if (!manage) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/transaction-pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: manage.user.id,
          action: manage.action,
          pin: manage.action === "set" ? newPin : undefined,
          notify: manage.action === "set" ? notifyUser : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      toast.success(
        manage.action === "set"
          ? "PIN updated"
          : manage.action === "clear"
            ? "PIN cleared"
            : "PIN unlocked",
      );
      setManage(null);
      setNewPin("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Transaction PINs"
        subtitle="View, set, unlock, or clear user transaction PINs"
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
            <select
              value={pinFilter}
              onChange={(e) => setPinFilter(e.target.value)}
              className="h-11 w-full rounded-[14px] border border-border bg-background px-3 text-sm sm:w-auto"
            >
              <option value="">All PIN states</option>
              <option value="set">PIN set</option>
              <option value="missing">No PIN</option>
              <option value="locked">Locked</option>
            </select>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users shown" value={String(data?.stats.total ?? 0)} />
        <StatCard
          label="PIN set"
          value={String(data?.stats.withPin ?? 0)}
          delay={0.04}
        />
        <StatCard
          label="No PIN"
          value={String(data?.stats.withoutPin ?? 0)}
          delay={0.08}
        />
        <StatCard
          label="Locked"
          value={String(data?.stats.locked ?? 0)}
          delay={0.12}
        />
      </div>

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {!loading && !error && (!data?.users.length) ? (
          <AdminEmptyBlock message="No users match this filter." />
        ) : null}
        {!loading && !error && data?.users.length ? (
          <AdminTable
            rows={data.users}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "user",
                header: "User",
                cell: (row) => (
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.email}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                hideOnMobile: true,
                cell: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: "pin",
                header: "Transaction PIN",
                cell: (row) => {
                  if (!row.hasPin) {
                    return (
                      <span className="text-xs font-medium text-muted-foreground">
                        Not set
                      </span>
                    );
                  }
                  const revealed = Boolean(revealIds[row.id]);
                  return (
                    <div className="flex items-center gap-2">
                      <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-[0.2em]">
                        {revealed ? row.pin || "••••" : "••••••"}
                      </code>
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() =>
                          setRevealIds((prev) => ({
                            ...prev,
                            [row.id]: !prev[row.id],
                          }))
                        }
                        aria-label={revealed ? "Hide PIN" : "Show PIN"}
                      >
                        {revealed ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  );
                },
              },
              {
                key: "attempts",
                header: "Attempts",
                hideOnMobile: true,
                cell: (row) => (
                  <span className="tabular-nums text-sm">
                    {row.failedPinAttempts}
                    {row.isLocked ? (
                      <span className="ml-2 text-xs font-semibold text-destructive">
                        Locked
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "",
                cell: (row) => (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-[10px] border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                      onClick={() => {
                        setNewPin("");
                        setNotifyUser(true);
                        setManage({ user: row, action: "set" });
                      }}
                    >
                      {row.hasPin ? "Reset" : "Set"}
                    </button>
                    {row.isLocked ? (
                      <button
                        type="button"
                        className="rounded-[10px] border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                        onClick={() =>
                          setManage({ user: row, action: "unlock" })
                        }
                      >
                        Unlock
                      </button>
                    ) : null}
                    {row.hasPin ? (
                      <button
                        type="button"
                        className="rounded-[10px] border border-destructive/30 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setManage({ user: row, action: "clear" })
                        }
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        ) : null}
      </AdminCard>

      <Dialog
        open={Boolean(manage)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setManage(null);
            setNewPin("");
          }
        }}
      >
        <DialogContent className="max-w-md rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {manage?.action === "set"
                ? manage.user.hasPin
                  ? "Reset transaction PIN"
                  : "Set transaction PIN"
                : manage?.action === "clear"
                  ? "Clear transaction PIN"
                  : "Unlock transaction PIN"}
            </DialogTitle>
            <DialogDescription>
              {manage
                ? `${manage.user.name} · ${manage.user.email}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {manage?.action === "set" ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">New PIN (4–6 digits)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="mt-1.5 h-11 w-full rounded-[14px] border border-border bg-background px-3 font-mono text-sm tracking-[0.25em] outline-none focus:border-primary"
                  placeholder="••••"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyUser}
                  onChange={(e) => setNotifyUser(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Email + push notify the user
              </label>
            </div>
          ) : manage?.action === "clear" ? (
            <p className="text-sm text-muted-foreground">
              This removes the user’s transaction PIN. They must create a new
              one before withdrawing again.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Clears failed attempts and unlocks the PIN immediately.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => setManage(null)}
              className="btn-secondary h-11 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                saving ||
                (manage?.action === "set" && newPin.length < 4)
              }
              onClick={() => void runAction()}
              className="btn-primary inline-flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
