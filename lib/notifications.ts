import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CheckCircle2,
  Gift,
  Settings2,
  ShieldAlert,
  Wifi,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { AppNotificationDto } from "@/lib/notification-types";

export type { AppNotificationDto } from "@/lib/notification-types";

export type NotificationVisual = {
  icon: LucideIcon;
  color: string;
};

export function notificationVisual(
  type: string | undefined,
): NotificationVisual {
  switch (type) {
    case "fund":
      return {
        icon: ArrowDownLeft,
        color: "text-[var(--oryno-success)] bg-muted",
      };
    case "withdraw":
      return {
        icon: ArrowUpRight,
        color: "text-primary bg-oryno-orange-muted",
      };
    case "success":
    case "service":
      return {
        icon: CheckCircle2,
        color: "text-[var(--oryno-success)] bg-muted",
      };
    case "error":
      return {
        icon: XCircle,
        color: "text-[var(--oryno-error)] bg-muted",
      };
    case "promo":
      return {
        icon: Gift,
        color: "text-primary bg-oryno-orange-muted",
      };
    case "kyc":
      return {
        icon: BadgeCheck,
        color: "text-primary bg-oryno-orange-muted",
      };
    case "security":
      return {
        icon: ShieldAlert,
        color: "text-primary bg-muted",
      };
    case "transfer":
      return {
        icon: Wifi,
        color: "text-primary bg-muted",
      };
    case "system":
    default:
      return {
        icon: type === "system" ? Settings2 : Bell,
        color: "text-primary bg-muted",
      };
  }
}

/** @deprecated Demo list — use /api/notifications */
export type AppNotification = AppNotificationDto & {
  icon: LucideIcon;
  color: string;
};
