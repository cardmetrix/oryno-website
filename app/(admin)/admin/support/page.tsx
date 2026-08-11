"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type TicketRow = {
  id: string;
  reference: string;
  topic: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  statusLabel: string;
  userName?: string | null;
  createdAt: string;
};

export default function AdminSupportPage() {
  const [status, setStatus] = useState("");
  const url = useMemo(
    () => `/api/admin/support${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    [status],
  );
  const { data, loading, error, reload } = useAdminQuery<{ tickets: TicketRow[] }>(
    url,
  );
  const [active, setActive] = useState<TicketRow | null>(null);
  const [reply, setReply] = useState("");
  const [nextStatus, setNextStatus] = useState<TicketRow["status"]>("in_progress");
  const [saving, setSaving] = useState(false);

  async function submitReply() {
    if (!active) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: active.id,
          status: nextStatus,
          reply,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast.success(`Updated ${active.reference}`);
      setActive(null);
      setReply("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Support tickets"
        subtitle="Reply to users and update ticket status"
        actions={
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-[14px] border border-border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        }
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {!loading && !error && !data?.tickets.length ? (
          <AdminEmptyBlock message="No support tickets yet." />
        ) : null}
        {!loading && !error && data?.tickets.length ? (
          <AdminTable
            rows={data.tickets}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "ref",
                header: "Ticket",
                cell: (row) => (
                  <div>
                    <p className="font-semibold">{row.reference}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.subject}
                    </p>
                  </div>
                ),
              },
              {
                key: "user",
                header: "User",
                cell: (row) => (
                  <div>
                    <p className="truncate text-sm">{row.userName || "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.email}
                    </p>
                  </div>
                ),
              },
              {
                key: "topic",
                header: "Topic",
                hideOnMobile: true,
                cell: (row) => row.topic,
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: "actions",
                header: "",
                cell: (row) => (
                  <button
                    type="button"
                    className="rounded-[10px] border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                    onClick={() => {
                      setActive(row);
                      setReply("");
                      setNextStatus(
                        row.status === "open" ? "in_progress" : row.status,
                      );
                    }}
                  >
                    Open
                  </button>
                ),
              },
            ]}
          />
        ) : null}
      </AdminCard>

      <Dialog
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open && !saving) setActive(null);
        }}
      >
        <DialogContent className="max-w-lg rounded-[24px]">
          <DialogHeader>
            <DialogTitle>{active?.reference}</DialogTitle>
            <DialogDescription>
              {active?.userName || active?.email} · {active?.topic}
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-[16px] bg-muted/50 px-3 py-3 text-sm">
            {active?.message}
          </p>
          <label className="mt-3 block">
            <span className="text-sm font-medium">Status</span>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-[14px] border border-border bg-background px-3 text-sm"
            >
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-medium">Reply (emails + notifies the user)</span>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
              className="mt-1.5 w-full resize-none rounded-[14px] border border-border bg-background px-3 py-2.5 text-sm"
              placeholder="Optional reply…"
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => setActive(null)}
              className="btn-secondary h-11 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submitReply()}
              className="btn-primary inline-flex h-11 items-center justify-center gap-2 text-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
