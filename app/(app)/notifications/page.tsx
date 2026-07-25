"use client";

import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { notifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Notifications"
        subtitle="Alerts, promos, and system updates"
        backHref="/dashboard"
        actions={
          <button
            type="button"
            className="text-sm font-semibold text-[var(--oryno-error)]"
          >
            Mark all as read
          </button>
        }
      />

      <MotionSection className="rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="space-y-3">
          {notifications.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-[16px] border border-border/80 px-3.5 py-3 transition hover:bg-muted/40",
                  item.unread && "bg-oryno-orange-muted/30",
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
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.body}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </MotionSection>
    </AppShell>
  );
}
