"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Bell, CheckCheck, X } from "lucide-react";
import {
  NotificationsDropdownEmpty,
  NotificationsDropdownSkeleton,
} from "@/components/app/notification-states";
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
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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
    setMounted(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load({ soft: true });
  }, [open, load]);

  const visible = useMemo(
    () => (filter === "unread" ? items.filter((n) => n.unread) : items),
    [filter, items],
  );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (window.matchMedia("(min-width: 768px)").matches) {
        if (!rootRef.current?.contains(event.target as Node)) {
          setOpen(false);
        }
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    const mq = window.matchMedia("(max-width: 767px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 90 || info.velocity.y > 650) {
      setOpen(false);
    }
  }

  const list = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1.5 [-webkit-overflow-scrolling:touch] md:max-h-[340px] md:flex-none">
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
                "mb-1 flex w-full items-start gap-3 rounded-[18px] px-3 py-3.5 text-left transition active:bg-muted/80 md:py-3 md:hover:bg-muted/70",
                item.unread && "bg-oryno-orange-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl md:h-10 md:w-10 md:rounded-full",
                  visual.color,
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold leading-snug text-foreground md:text-sm">
                    {item.title}
                  </p>
                  {item.unread ? (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground md:mt-0.5 md:text-xs">
                  {item.body}
                </p>
                <p className="mt-1.5 text-xs font-medium text-muted-foreground/90 md:mt-1 md:text-[11px]">
                  {item.time}
                </p>
              </div>
            </motion.button>
          );
        })
      )}
    </div>
  );

  const footer = (
    <div className="shrink-0 border-t border-border p-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] md:pb-3">
      <Link
        href="/notifications"
        onClick={() => setOpen(false)}
        className="btn-secondary inline-flex h-12 w-full items-center justify-center text-sm md:h-11"
      >
        View all notifications
      </Link>
    </div>
  );

  const header = (
    <div className="shrink-0 border-b border-border px-4 pt-1 pb-3 md:pt-0 md:pb-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground md:text-sm">
            Notifications
          </p>
          <p className="text-xs text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You're up to date"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary transition enabled:hover:bg-oryno-orange-muted disabled:opacity-40 md:h-auto md:rounded-none md:px-0 md:hover:bg-transparent"
          >
            <CheckCheck className="h-3.5 w-3.5 md:hidden" />
            Mark all read
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-border bg-background md:hidden"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2 md:hidden">
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
              "h-9 rounded-full px-3.5 text-xs font-semibold transition",
              filter === tab.id
                ? "bg-oryno-charcoal text-white"
                : "bg-muted text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  const mobileSheet = mounted
    ? createPortal(
        <AnimatePresence>
          {open ? (
            <div key="notif-sheet" className="fixed inset-0 z-[80] md:hidden">
              <motion.button
                type="button"
                aria-label="Close notifications"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-oryno-charcoal/45 backdrop-blur-[3px]"
                onClick={() => setOpen(false)}
              />

              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Notifications"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.05, bottom: 0.55 }}
                onDragEnd={onDragEnd}
                className="absolute inset-x-0 bottom-0 flex max-h-[min(88svh,720px)] flex-col overflow-hidden rounded-t-[28px] border border-border/80 bg-background shadow-[0_-18px_50px_rgba(0,0,0,0.28)]"
              >
                <div className="flex shrink-0 justify-center pt-3 pb-1">
                  <span className="h-1.5 w-12 rounded-full bg-border" />
                </div>
                {header}
                {list}
                {footer}
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        type="button"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)] transition hover:bg-muted"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5 text-foreground" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="absolute top-[calc(100%+0.6rem)] right-0 z-50 hidden w-[380px] max-h-[min(70vh,480px)] flex-col overflow-hidden rounded-[20px] border border-border bg-background shadow-[var(--shadow-lg)] md:flex"
          >
            {header}
            {list}
            {footer}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {mobileSheet}
    </div>
  );
}
