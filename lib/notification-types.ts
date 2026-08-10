export type NotificationType =
  | "system"
  | "fund"
  | "withdraw"
  | "success"
  | "error"
  | "promo"
  | "security"
  | "transfer"
  | "service"
  | "kyc"
  | "referral";

export type AppNotificationDto = {
  id: string;
  title: string;
  body: string;
  type: NotificationType | string;
  unread: boolean;
  time: string;
  createdAt: string;
  href?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type NotificationsPayload = {
  items: AppNotificationDto[];
  unreadCount: number;
  count: number;
};
