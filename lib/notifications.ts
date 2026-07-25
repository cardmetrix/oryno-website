import {
  CheckCircle2,
  Gift,
  Settings2,
  type LucideIcon,
  XCircle,
} from "lucide-react";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  unread?: boolean;
  icon: LucideIcon;
  color: string;
};

export const notifications: AppNotification[] = [
  {
    id: "n1",
    title: "Airtime purchase successful",
    body: "₦2,000 MTN airtime sent to 0803••••222",
    time: "2:14 PM",
    unread: true,
    icon: CheckCircle2,
    color: "text-[var(--oryno-success)] bg-muted",
  },
  {
    id: "n2",
    title: "Weekend promo: 2% bonus on data",
    body: "Boost your next data purchase and earn cashback.",
    time: "11:02 AM",
    unread: true,
    icon: Gift,
    color: "text-primary bg-oryno-orange-muted",
  },
  {
    id: "n3",
    title: "Security settings updated",
    body: "Your PIN and login preferences were changed.",
    time: "Yesterday",
    icon: Settings2,
    color: "text-primary bg-muted",
  },
  {
    id: "n4",
    title: "Electricity bill payment failed",
    body: "IKEDC payment could not complete. Funds were reversed.",
    time: "Yesterday",
    icon: XCircle,
    color: "text-[var(--oryno-error)] bg-muted",
  },
];

export const unreadNotificationCount = notifications.filter((n) => n.unread)
  .length;
