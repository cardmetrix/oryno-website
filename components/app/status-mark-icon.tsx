import {
  CheckCircle2,
  Clock3,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusMark = "Successful" | "Pending" | "Failed" | "Reversed";

export function normalizeStatusMark(status: string): StatusMark {
  const s = status.toLowerCase();
  if (s === "reversed") return "Reversed";
  if (s === "failed" || s === "error") return "Failed";
  if (s === "pending" || s === "processing") return "Pending";
  return "Successful";
}

const ICONS: Record<StatusMark, LucideIcon> = {
  Successful: CheckCircle2,
  Pending: Clock3,
  Failed: XCircle,
  Reversed: RotateCcw,
};

/** Large status glyph used on receipts and service result modals. */
export function StatusMarkIcon({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const Icon = ICONS[normalizeStatusMark(status)];
  return (
    <span
      className={cn(
        "flex h-14 w-14 items-center justify-center",
        className,
      )}
    >
      <Icon className="h-full w-full" strokeWidth={1.75} />
    </span>
  );
}

export function statusMarkIcon(status: string): LucideIcon {
  return ICONS[normalizeStatusMark(status)];
}
