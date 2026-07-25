"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  Gift,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

const alerts = [
  {
    id: "a1",
    icon: CheckCircle2,
    title: "Airtime delivered",
    body: "₦2,000 MTN top-up completed",
    time: "2m ago",
    href: "/notifications",
    tone: "text-[var(--oryno-success)] bg-muted",
  },
  {
    id: "a2",
    icon: Gift,
    title: "Promo unlocked",
    body: "Cashback on your next bill payment",
    time: "1h ago",
    href: "/services/bills",
    tone: "text-primary bg-oryno-orange-muted",
  },
  {
    id: "a3",
    icon: ShieldAlert,
    title: "Security tip",
    body: "Enable 2FA in Settings for safer logins",
    time: "Today",
    href: "/settings/security",
    tone: "text-[var(--oryno-warning)] bg-muted",
  },
];

export function DashboardAlerts() {
  return (
    <div className="flex h-full flex-col rounded-[28px] border border-border/80 bg-background/90 p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
            <Bell className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Alerts</h2>
            <p className="text-xs text-muted-foreground">Live updates</p>
          </div>
        </div>
        <Link
          href="/notifications"
          className="text-xs font-semibold text-primary"
        >
          See all
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-2.5">
        {alerts.map((alert, index) => {
          const Icon = alert.icon;
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 + index * 0.05 }}
              whileHover={{ x: 2 }}
            >
              <Link
                href={alert.href}
                className="flex items-start gap-3 rounded-[16px] border border-border/70 px-3 py-3 transition-colors hover:bg-muted/50"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    alert.tone,
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {alert.title}
                    </p>
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                      {alert.time}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {alert.body}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
