import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  Active: "bg-oryno-orange-muted text-primary",
  Live: "bg-oryno-orange-muted text-primary",
  Connected: "bg-oryno-orange-muted text-primary",
  Healthy: "bg-oryno-orange-muted text-primary",
  Verified: "bg-oryno-orange-muted text-primary",
  Completed: "bg-muted text-[var(--oryno-success)]",
  Sent: "bg-muted text-[var(--oryno-success)]",
  In: "bg-oryno-orange-muted text-primary",
  Pending: "bg-muted text-[var(--oryno-warning)]",
  Scheduled: "bg-muted text-[var(--oryno-warning)]",
  Processing: "bg-muted text-[var(--oryno-warning)]",
  Beta: "bg-muted text-[var(--oryno-warning)]",
  Draft: "bg-muted text-muted-foreground",
  Paused: "bg-muted text-muted-foreground",
  Soon: "bg-muted text-muted-foreground",
  Available: "bg-muted text-muted-foreground",
  Maintenance: "bg-muted text-[var(--oryno-warning)]",
  Suspended: "bg-muted text-[var(--oryno-error)]",
  Failed: "bg-muted text-[var(--oryno-error)]",
  Frozen: "bg-muted text-[var(--oryno-error)]",
  Unverified: "bg-muted text-muted-foreground",
  Low: "bg-muted text-[var(--oryno-warning)]",
  "Buy out": "bg-muted text-[var(--oryno-error)]",
  "In stock": "bg-oryno-orange-muted text-primary",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone =
    tones[status] ??
    (status.startsWith("In ")
      ? "bg-oryno-orange-muted text-primary"
      : "bg-muted text-muted-foreground");

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        tone,
        className,
      )}
    >
      {status}
    </span>
  );
}
