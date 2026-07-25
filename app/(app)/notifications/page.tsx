"use client";

import { CheckCircle2, Gift, Settings2, XCircle } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

const groups = [
  {
    label: "Today",
    items: [
      {
        icon: CheckCircle2,
        color: "text-oryno-success bg-oryno-success/12",
        title: "Airtime purchase successful",
        time: "2:14 PM",
      },
      {
        icon: Gift,
        color: "text-primary bg-oryno-orange-muted",
        title: "Weekend promo: 2% bonus on data",
        time: "11:02 AM",
      },
    ],
  },
  {
    label: "Yesterday",
    items: [
      {
        icon: Settings2,
        color: "text-blue-600 bg-blue-50",
        title: "Security settings updated",
        time: "Oct 23",
      },
      {
        icon: XCircle,
        color: "text-oryno-error bg-oryno-error/10",
        title: "Electricity bill payment failed",
        time: "Oct 23",
      },
    ],
  },
];

export default function NotificationsPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Notifications"
        subtitle="Alerts, promos, and system updates"
        backHref="/dashboard"
        actions={
          <button type="button" className="text-sm font-semibold text-oryno-error">
            Mark all as read
          </button>
        }
      />

      <div className="space-y-5">
        {groups.map((group, index) => (
          <MotionSection
            key={group.label}
            delay={index * 0.06}
            className="rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5"
          >
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.label}
            </p>
            <div className="space-y-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-[16px] border border-border/80 px-3.5 py-3 transition hover:bg-muted/40"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.color}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </MotionSection>
        ))}
      </div>
    </AppShell>
  );
}
