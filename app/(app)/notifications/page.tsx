"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCheck,
  Search,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import {
  NotificationsEmpty,
  NotificationsError,
  NotificationsSkeleton,
} from "@/components/app/notification-states";
import { PageHeader } from "@/components/app/page-header";
import type { AppNotificationDto, NotificationsPayload } from "@/lib/notification-types";
import { notificationVisual } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const filters = ["All", "Unread", "Wallet", "System"] as const;

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const applyPayload = useCallback((json: NotificationsPayload) => {
    setItems(json.items);
    setUnreadCount(json.unreadCount);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as NotificationsPayload;
      applyPayload(json);
    } catch {
      setError(true);
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter =
        filter === "All" ||
        (filter === "Unread" && item.unread) ||
        (filter === "Wallet" &&
          (item.type === "fund" || item.type === "withdraw")) ||
        (filter === "System" &&
          (item.type === "system" ||
            item.type === "security" ||
            item.type === "promo"));

      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q);

      return matchesFilter && matchesQuery;
    });
  }, [items, filter, query]);

  async function markAllRead() {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    if (!res.ok) return;
    applyPayload((await res.json()) as NotificationsPayload);
  }

  async function markOneRead(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) return;
      applyPayload((await res.json()) as NotificationsPayload);
    } finally {
      setBusyId(null);
    }
  }

  async function removeOne(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(
        `/api/notifications?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) return;
      applyPayload((await res.json()) as NotificationsPayload);
    } finally {
      setBusyId(null);
    }
  }

  async function clearRead() {
    const res = await fetch("/api/notifications?clearRead=1", {
      method: "DELETE",
    });
    if (!res.ok) return;
    applyPayload((await res.json()) as NotificationsPayload);
  }

  async function openItem(item: AppNotificationDto) {
    if (item.unread) await markOneRead(item.id);
    if (item.href) router.push(item.href);
  }

  const hasFilters = filter !== "All" || Boolean(query.trim());

  return (
    <AppShell hideNav>
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread alert${unreadCount === 1 ? "" : "s"}`
            : "Alerts, wallet updates & promos"
        }
        backHref="/dashboard"
        actions={
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary disabled:opacity-40"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        }
      />

      {loading ? (
        <NotificationsSkeleton />
      ) : error ? (
        <NotificationsError onRetry={() => void load()} />
      ) : (
        <>
          <MotionSection className="rounded-[28px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notifications…"
                className="h-12 w-full rounded-[16px] border border-border bg-muted/40 pr-4 pl-10 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
              />
            </div>

            <div className="mt-3.5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filters.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition sm:text-sm",
                    filter === tab
                      ? "bg-oryno-charcoal text-white shadow-[var(--shadow-soft)]"
                      : "bg-muted text-muted-foreground hover:bg-oryno-orange-muted hover:text-primary",
                  )}
                >
                  {tab}
                  {tab === "Unread" && unreadCount > 0
                    ? ` · ${unreadCount}`
                    : ""}
                </button>
              ))}
            </div>

            {items.some((i) => !i.unread) ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void clearRead()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear read
                </button>
              </div>
            ) : null}
          </MotionSection>

          <div className="mt-4">
            <AnimatePresence mode="wait">
              {visible.length === 0 ? (
                <NotificationsEmpty
                  key="empty"
                  filtered={hasFilters}
                  onClear={() => {
                    setFilter("All");
                    setQuery("");
                  }}
                />
              ) : (
                <motion.div
                  key={`${filter}-${query}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2.5"
                >
                  {visible.map((item, index) => {
                    const visual = notificationVisual(item.type);
                    const Icon = visual.icon;
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: Math.min(index * 0.03, 0.24),
                        }}
                        className={cn(
                          "group flex items-start gap-3 rounded-[20px] border border-border/80 bg-background px-3.5 py-3.5 shadow-[var(--shadow-soft)] transition hover:border-primary/25",
                          item.unread && "bg-oryno-orange-muted/30",
                          busyId === item.id && "opacity-60",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void openItem(item)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <span
                            className={cn(
                              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                              visual.color,
                            )}
                          >
                            <Icon className="h-5 w-5" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {item.title}
                              </p>
                              {item.unread ? (
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                              {item.body}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <p className="text-[11px] font-medium text-muted-foreground">
                                {item.time}
                              </p>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                                {item.type}
                              </span>
                              {item.href ? (
                                <Link
                                  href={item.href}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[11px] font-semibold text-primary"
                                >
                                  Open
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </button>

                        <div className="flex shrink-0 flex-col gap-1.5">
                          {item.unread ? (
                            <button
                              type="button"
                              onClick={() => void markOneRead(item.id)}
                              className="rounded-full px-2 py-1 text-[10px] font-bold text-primary hover:bg-oryno-orange-muted"
                            >
                              Read
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void removeOne(item.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border text-muted-foreground transition hover:border-destructive hover:text-destructive"
                            aria-label="Delete notification"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </AppShell>
  );
}
