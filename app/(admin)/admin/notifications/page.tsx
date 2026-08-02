"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Save, Search, Send, Users } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import type { AdminEmailTemplate } from "@/lib/admin/email-templates";
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { cn } from "@/lib/utils";

type AudienceMode = "all" | "selected" | "individual";

type CampaignRow = {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: string;
  statusLabel: string;
  subject: string;
  templateId: string;
  mode: AudienceMode;
  userIds: string[];
  selectedUsers: Array<{ id: string; email: string; fullName: string }>;
  individualEmail: string;
  ctaLabel: string;
  ctaHref: string;
  notificationType: string;
  sendInApp: boolean;
  sendEmail: boolean;
  stats: {
    recipients: number;
    emailed: number;
    notified: number;
    failed: number;
  } | null;
  when: string;
};

type UserPick = {
  id: string;
  name: string;
  email: string;
  status: string;
  country: string;
};

type Response = {
  templates: AdminEmailTemplate[];
  activeUserCount: number;
  campaigns: CampaignRow[];
  recent: Array<{ id: string; title: string; type: string; when: string }>;
};

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary";
const areaClass =
  "mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

export default function AdminNotificationsPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/notifications");

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState("custom");
  const [mode, setMode] = useState<AudienceMode>("all");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Open ORYNO");
  const [ctaHref, setCtaHref] = useState("/dashboard");
  const [individualEmail, setIndividualEmail] = useState("");
  const [selected, setSelected] = useState<UserPick[]>([]);
  const [sendInApp, setSendInApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);

  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserPick[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const templates = data?.templates || [];
  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || templates[0],
    [templates, templateId],
  );

  function pickTemplate(t: AdminEmailTemplate) {
    setTemplateId(t.id);
    if (t.id === "custom") return;
    setSubject(t.subject);
    setTitle(t.title);
    setBody(t.body);
    setCtaLabel(t.ctaLabel);
    setCtaHref(t.ctaHref);
  }

  useEffect(() => {
    if (mode !== "selected" && mode !== "individual") return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        setUsersLoading(true);
        try {
          const res = await fetch(
            `/api/admin/notifications/users?q=${encodeURIComponent(userQuery)}`,
            { cache: "no-store" },
          );
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Failed to load users");
          if (!cancelled) setUserResults(json.users || []);
        } catch (e) {
          if (!cancelled) {
            toast.error(e instanceof Error ? e.message : "Failed to load users");
          }
        } finally {
          if (!cancelled) setUsersLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [userQuery, mode]);

  function applyCampaign(c: CampaignRow) {
    setCampaignId(c.id);
    setTemplateId(c.templateId || "custom");
    setMode(c.mode || "all");
    setSubject(c.subject || c.title);
    setTitle(c.title);
    setBody(c.body);
    setCtaLabel(c.ctaLabel || "Open ORYNO");
    setCtaHref(c.ctaHref || "/dashboard");
    setIndividualEmail(c.individualEmail || "");
    setSendInApp(c.sendInApp !== false);
    setSendEmail(c.sendEmail !== false);
    setSelected(
      (c.selectedUsers || []).map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        status: "active",
        country: "—",
      })),
    );
    toast.message("Draft loaded into composer");
  }

  function resetComposer() {
    setCampaignId(null);
    setTemplateId("custom");
    setMode("all");
    setSubject("");
    setTitle("");
    setBody("");
    setCtaLabel("Open ORYNO");
    setCtaHref("/dashboard");
    setIndividualEmail("");
    setSelected([]);
    setSendInApp(true);
    setSendEmail(true);
  }

  function toggleUser(user: UserPick) {
    setSelected((prev) => {
      if (prev.some((p) => p.id === user.id)) {
        return prev.filter((p) => p.id !== user.id);
      }
      return [...prev, user];
    });
  }

  async function submit(action: "draft" | "send") {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    if (mode === "individual" && !individualEmail.trim()) {
      toast.error("Enter the user’s email");
      return;
    }
    if (mode === "selected" && selected.length === 0) {
      toast.error("Select at least one user");
      return;
    }
    if (!sendInApp && !sendEmail) {
      toast.error("Enable email and/or in-app delivery");
      return;
    }

    setBusy(action);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          campaignId,
          templateId,
          mode,
          subject: subject || title,
          title,
          body,
          ctaLabel,
          ctaHref,
          notificationType: activeTemplate?.notificationType || "promo",
          individualEmail,
          userIds: selected.map((u) => u.id),
          sendInApp,
          sendEmail,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");

      if (action === "draft") {
        setCampaignId(json.campaign?.id || null);
        toast.success("Draft saved");
      } else {
        const s = json.stats;
        toast.success(
          `Sent to ${s?.recipients ?? 0} · emailed ${s?.emailed ?? 0} · in-app ${s?.notified ?? 0}`,
        );
        resetComposer();
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const recipientHint =
    mode === "all"
      ? `${data?.activeUserCount ?? "…"} active users`
      : mode === "selected"
        ? `${selected.length} selected`
        : individualEmail.trim() || "one email";

  return (
    <>
      <AdminPageHeader
        title="Notifications & Email"
        subtitle="Draft or send branded emails and in-app alerts to one user, selected users, or everyone"
        actions={
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={resetComposer}
            className="btn-secondary h-11 px-4 text-sm"
          >
            New message
          </motion.button>
        }
      />

      {loading ? <AdminLoadingBlock variant="split" /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}

      {data ? (
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <AdminCard title="Compose" delay={0.05}>
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Template
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickTemplate(t)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left transition",
                        templateId === t.id
                          ? "border-primary bg-oryno-orange-muted"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {t.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Audience
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["all", "Broadcast all"],
                      ["selected", "Selected"],
                      ["individual", "One user"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={cn(
                        "h-10 rounded-xl text-xs font-semibold transition sm:text-sm",
                        mode === value
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Recipients: {recipientHint}
                </p>
              </div>

              {mode === "individual" ? (
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">
                    User email
                  </span>
                  <input
                    value={individualEmail}
                    onChange={(e) => setIndividualEmail(e.target.value)}
                    placeholder="user@email.com"
                    className={inputClass}
                  />
                </label>
              ) : null}

              {mode === "selected" ? (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Search users by name or email…"
                      className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary"
                    />
                  </div>
                  {selected.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleUser(u)}
                          className="rounded-full bg-oryno-orange-muted px-2.5 py-1 text-[11px] font-semibold text-primary"
                        >
                          {u.name} ×
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {usersLoading ? (
                      <p className="px-1 py-2 text-xs text-muted-foreground">
                        Searching…
                      </p>
                    ) : userResults.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-muted-foreground">
                        No users found
                      </p>
                    ) : (
                      userResults.map((u) => {
                        const on = selected.some((s) => s.id === u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => toggleUser(u)}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                              on ? "bg-oryno-orange-muted" : "hover:bg-muted/60",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {u.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {u.email}
                              </span>
                            </span>
                            <span className="shrink-0 text-[11px] font-semibold text-primary">
                              {on ? "Selected" : "Add"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Email subject
                  </span>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line"
                    className={inputClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Title (in-app + email heading)
                  </span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Message title"
                    className={inputClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Message body
                  </span>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={7}
                    placeholder="Use {{name}} to personalize the greeting"
                    className={areaClass}
                  />
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Tip: {"{{name}}"} inserts the user’s first name.
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">
                    CTA label
                  </span>
                  <input
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">
                    CTA link
                  </span>
                  <input
                    value={ctaHref}
                    onChange={(e) => setCtaHref(e.target.value)}
                    placeholder="/dashboard"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-between gap-3 sm:justify-start">
                  <span className="text-sm font-semibold">Send email</span>
                  <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-start">
                  <span className="text-sm font-semibold">In-app notification</span>
                  <Switch checked={sendInApp} onCheckedChange={setSendInApp} />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={busy !== null}
                  onClick={() => void submit("draft")}
                  className="btn-secondary inline-flex h-11 flex-1 items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {busy === "draft" ? "Saving…" : "Save draft"}
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={busy !== null}
                  onClick={() => void submit("send")}
                  className="btn-primary inline-flex h-11 flex-1 items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {busy === "send" ? "Sending…" : "Send now"}
                </motion.button>
              </div>

              {campaignId ? (
                <p className="text-xs text-muted-foreground">
                  Editing campaign <span className="font-mono">{campaignId.slice(0, 8)}</span>
                </p>
              ) : null}
            </div>
          </AdminCard>

          <div className="space-y-5">
            <AdminCard title="Campaigns" delay={0.08}>
              {data.campaigns.length === 0 ? (
                <AdminEmptyBlock message="No campaigns yet. Draft or send your first message." />
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto">
                  {data.campaigns.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => applyCampaign(c)}
                      className="w-full rounded-xl border border-border px-3 py-3 text-left transition hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {c.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {c.audience} · {c.when}
                          </p>
                        </div>
                        <StatusBadge status={c.statusLabel} />
                      </div>
                      {c.stats ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {c.stats.recipients} recipients · {c.stats.emailed}{" "}
                          emailed · {c.stats.notified} in-app
                          {c.stats.failed
                            ? ` · ${c.stats.failed} failed`
                            : ""}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </AdminCard>

            <AdminCard title="Recent in-app notifications" delay={0.12}>
              {data.recent.length === 0 ? (
                <AdminEmptyBlock message="No notifications sent yet." />
              ) : (
                <AdminTable
                  rows={data.recent}
                  rowKey={(row) => row.id}
                  columns={[
                    {
                      key: "title",
                      header: "Title",
                      cell: (row) => (
                        <span className="font-semibold">{row.title}</span>
                      ),
                    },
                    { key: "type", header: "Type", cell: (row) => row.type },
                    { key: "when", header: "When", cell: (row) => row.when },
                  ]}
                />
              )}
            </AdminCard>

            <AdminCard delay={0.14}>
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Branded delivery</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Emails use the ORYNO header, logo, and footer. In-app alerts
                    appear in the user notification center.
                  </p>
                </div>
              </div>
            </AdminCard>
          </div>
        </div>
      ) : null}
    </>
  );
}
