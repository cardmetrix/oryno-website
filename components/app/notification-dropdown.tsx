"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import {
  notifications,
  unreadNotificationCount,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    // Lock scroll only on small screens where sheet covers content
    const mq = window.matchMedia("(max-width: 767px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
        {unreadNotificationCount > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {unreadNotificationCount}
          </span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <>
            {/* Mobile backdrop */}
            <motion.button
              type="button"
              aria-label="Close notifications"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-oryno-charcoal/35 backdrop-blur-[2px] md:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              role="dialog"
              aria-label="Notifications"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={cn(
                "z-50 overflow-hidden border border-border bg-background shadow-[var(--shadow-lg)]",
                // Mobile: bottom sheet
                "fixed inset-x-0 bottom-0 max-h-[min(78svh,640px)] rounded-t-[24px]",
                // Desktop: anchored dropdown
                "md:absolute md:inset-x-auto md:top-[calc(100%+0.6rem)] md:right-0 md:bottom-auto md:w-[380px] md:max-h-[min(70vh,480px)] md:rounded-[20px]",
              )}
            >
              <div className="flex justify-center pt-2 md:hidden">
                <span className="h-1.5 w-10 rounded-full bg-border" />
              </div>

              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Notifications
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {unreadNotificationCount} unread
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary"
                  >
                    Mark all read
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-background md:hidden"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[min(58svh,420px)] overflow-y-auto overscroll-contain p-2 md:max-h-[340px]">
                {notifications.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-[16px] px-3 py-3 text-left transition hover:bg-muted/70",
                        item.unread && "bg-oryno-orange-muted/35",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                          item.color,
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
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.body}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                          {item.time}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="btn-secondary inline-flex h-11 w-full items-center justify-center text-sm"
                >
                  View all notifications
                </Link>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
