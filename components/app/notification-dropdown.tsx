"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import {
  NotificationsDropdownEmpty,
  NotificationsDropdownSkeleton,
} from "@/components/app/notification-states";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  AppNotificationDto,
  NotificationsPayload,
} from "@/lib/notification-types";
import { notificationVisual } from "@/lib/notifications";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread";

export function NotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<AppNotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchedOnce = useRef(false);

  const applyPayload = useCallback((json: NotificationsPayload) => {
    setItems(json.items);
    setUnreadCount(json.unreadCount);
  }, []);

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!opts?.soft) setLoading(true);
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        applyPayload((await res.json()) as NotificationsPayload);
      } catch {
        if (!fetchedOnce.current) {
          setItems([]);
          setUnreadCount(0);
        }
      } finally {
        setLoading(false);
        fetchedOnce.current = true;
      }
    },
    [applyPayload],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 400);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const visible = useMemo(
    () => (filter === "unread" ? items.filter((n) => n.unread) : items),
    [filter, items],
  );

  async function markAllRead() {
    const res = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    if (!res.ok) return;
    applyPayload((await res.json()) as NotificationsPayload);
  }

  async function openItem(item: AppNotificationDto) {
    if (item.unread) {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (res.ok) {
        applyPayload((await res.json()) as NotificationsPayload);
      }
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          className="relative flex h-10 w-10 items-center justify-center rounded-[14px] "
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-foreground" strokeWidth={1.75} />
          {unreadCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </motion.button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={10}
        collisionPadding={12}
        className="z-[80] w-[min(22.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[20px] border border-border bg-popover p-0 text-popover-foreground shadow-[var(--shadow-lg)]"
      >
        <div className="flex max-h-[min(70vh,480px)] flex-col">
          <div className="shrink-0 border-b border-border px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">
                  Notifications
                </p>
                <p className="text-xs text-muted-foreground">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : "You're up to date"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={unreadCount === 0}
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary transition hover:opacity-80 disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              {(
                [
                  { id: "all", label: "All" },
                  {
                    id: "unread",
                    label: `Unread${unreadCount ? ` · ${unreadCount}` : ""}`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    "h-8 rounded-full px-3 text-xs font-semibold transition",
                    filter === tab.id
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1.5">
            {loading && items.length === 0 ? (
              <NotificationsDropdownSkeleton />
            ) : visible.length === 0 ? (
              <NotificationsDropdownEmpty filter={filter} />
            ) : (
              visible.slice(0, 12).map((item, index) => {
                const visual = notificationVisual(item.type);
                const Icon = visual.icon;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.18) }}
                    onClick={() => void openItem(item)}
                    className={cn(
                      "mb-1 flex w-full items-start gap-3 rounded-[16px] px-3 py-3 text-left transition hover:bg-muted/70",
                      item.unread && "bg-oryno-orange-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        visual.color,
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug text-foreground">
                          {item.title}
                        </p>
                        {item.unread ? (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-muted-foreground/90">
                        {item.time}
                      </p>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>

          <div className="shrink-0 border-t border-border p-3">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="btn-secondary inline-flex h-11 w-full items-center justify-center text-sm"
            >
              View all notifications
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
