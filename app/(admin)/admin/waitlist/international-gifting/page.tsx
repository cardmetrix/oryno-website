"use client";

import { useMemo, useState } from "react";
import { Bell, Loader2, Search, Trash2 } from "lucide-react";
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

type Entry = {
  id: string;
  email: string;
  name: string;
  userId: string | null;
  countryCode: string | null;
  notifiedAt: string | null;
  joinedAt: string;
};

export default function AdminInternationalGiftingWaitlistPage() {
  const { data, loading, error, reload } = useAdminQuery<{
    count: number;
    notifiedCount: number;
    pendingNotifyCount: number;
    entries: Entry[];
  }>("/api/admin/waitlist/international-gifting");

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.entries ?? [];
    if (!q) return list;
    return list.filter(
      (e) =>
        e.email.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.countryCode || "").toLowerCase().includes(q),
    );
  }, [data?.entries, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((e) => e.id)));
  }

  async function onDelete(ids: string[]) {
    if (!ids.length) return;
    if (
      !window.confirm(
        `Remove ${ids.length} waitlist entr${ids.length === 1 ? "y" : "ies"}?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/waitlist/international-gifting", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as { error?: string; removed?: number };
      if (!res.ok) throw new Error(json.error || "Delete failed");
      toast.success(`Removed ${json.removed ?? ids.length}`);
      setSelected(new Set());
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function onNotify(ids?: string[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/waitlist/international-gifting", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "notify",
          ids: ids?.length ? ids : undefined,
          title: notifyTitle.trim() || undefined,
          body: notifyBody.trim() || undefined,
          onlyUnnotified: !ids?.length,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        notified?: number;
        skipped?: number;
      };
      if (!res.ok) throw new Error(json.error || "Notify failed");
      toast.success(
        `Notified ${json.notified ?? 0}${json.skipped ? ` (${json.skipped} skipped)` : ""}`,
      );
      setSelected(new Set());
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Notify failed");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows = filtered;
    const header = ["name", "email", "country", "joinedAt", "notifiedAt"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          JSON.stringify(r.name),
          JSON.stringify(r.email),
          JSON.stringify(r.countryCode || ""),
          JSON.stringify(r.joinedAt),
          JSON.stringify(r.notifiedAt || ""),
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `international-gifting-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AdminPageHeader
        title="International Gifting waitlist"
        subtitle="Users waiting for cross-border digital gifting"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Joined" value={String(data?.count ?? 0)} />
        <StatCard
          label="Notified"
          value={String(data?.notifiedCount ?? 0)}
          delay={0.04}
        />
        <StatCard
          label="Pending notify"
          value={String(data?.pendingNotifyCount ?? 0)}
          delay={0.08}
        />
      </div>

      <AdminCard className="mb-5 p-4">
        <p className="mb-3 text-sm font-semibold">Launch notification</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={notifyTitle}
            onChange={(e) => setNotifyTitle(e.target.value)}
            placeholder="Optional custom title"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <input
            value={notifyBody}
            onChange={(e) => setNotifyBody(e.target.value)}
            placeholder="Optional custom message"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !(data?.pendingNotifyCount ?? 0)}
            onClick={() => void onNotify()}
            className="btn-primary inline-flex h-10 items-center gap-2 px-4 text-sm disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Notify unnotified
          </button>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void onNotify([...selected])}
            className="btn-secondary inline-flex h-10 items-center gap-2 px-4 text-sm disabled:opacity-50"
          >
            Notify selected ({selected.size})
          </button>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void onDelete([...selected])}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--oryno-error)]/10 px-4 text-sm font-semibold text-[var(--oryno-error)] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Remove selected
          </button>
          <button
            type="button"
            disabled={!filtered.length}
            onClick={exportCsv}
            className="btn-secondary inline-flex h-10 items-center px-4 text-sm disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </AdminCard>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, country..."
            className="h-10 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-sm"
          />
        </div>
      </div>

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {!loading && !error && !filtered.length ? (
          <AdminEmptyBlock message="No waitlist signups yet." />
        ) : null}
        {!loading && !error && filtered.length ? (
          <AdminTable
            rows={filtered}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "select",
                header: (
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 && selected.size === filtered.length
                    }
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                ),
                hideOnMobile: true,
                cell: (row) => (
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${row.email}`}
                  />
                ),
              },
              {
                key: "user",
                header: "User",
                cell: (row) => (
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </div>
                ),
              },
              {
                key: "country",
                header: "Country",
                cell: (row) => row.countryCode || "-",
              },
              {
                key: "status",
                header: "Notify",
                cell: (row) => (
                  <StatusBadge status={row.notifiedAt ? "Sent" : "Pending"} />
                ),
              },
              {
                key: "joined",
                header: "Joined",
                cell: (row) =>
                  new Date(row.joinedAt).toLocaleString("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
              },
              {
                key: "actions",
                header: "",
                cell: (row) => (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onNotify([row.id])}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[11px] font-semibold",
                        "bg-muted hover:bg-muted/80 disabled:opacity-50",
                      )}
                    >
                      Notify
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onDelete([row.id])}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--oryno-error)] hover:bg-[var(--oryno-error)]/10 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ),
              },
            ]}
          />
        ) : null}
      </AdminCard>
    </>
  );
}
