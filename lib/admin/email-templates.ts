export type AdminEmailTemplateId =
  | "custom"
  | "sign_in_notice"
  | "account_suspended"
  | "account_reactivated"
  | "kyc_reminder"
  | "wallet_promo"
  | "app_maintenance"
  | "security_alert"
  | "feature_update";

export type AdminEmailTemplate = {
  id: AdminEmailTemplateId;
  label: string;
  description: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  notificationType: string;
};

export const ADMIN_EMAIL_TEMPLATES: AdminEmailTemplate[] = [
  {
    id: "custom",
    label: "Blank / custom",
    description: "Write your own subject and message",
    subject: "",
    title: "",
    body: "",
    ctaLabel: "Open ORYNO",
    ctaHref: "/dashboard",
    notificationType: "promo",
  },
  {
    id: "sign_in_notice",
    label: "Sign-in notice",
    description: "Alert a user about a recent or unexpected sign-in",
    subject: "New sign-in to your ORYNO account",
    title: "New sign-in detected",
    body: "Hi {{name}},\n\nWe noticed a sign-in to your ORYNO account. If this was you, you can ignore this message.\n\nIf you don’t recognize this activity, reset your password and contact support immediately.",
    ctaLabel: "Review security",
    ctaHref: "/settings/security",
    notificationType: "security",
  },
  {
    id: "account_suspended",
    label: "Account suspended",
    description: "Notify a user that their account was suspended",
    subject: "Your ORYNO account has been suspended",
    title: "Account suspended",
    body: "Hi {{name}},\n\nYour ORYNO account has been suspended and wallet access is temporarily limited.\n\nIf you believe this was a mistake, reply to support with your registered email and we’ll review your case.",
    ctaLabel: "Contact support",
    ctaHref: "/support",
    notificationType: "system",
  },
  {
    id: "account_reactivated",
    label: "Account reactivated",
    description: "Tell a user their account is active again",
    subject: "Your ORYNO account is active again",
    title: "Account reactivated",
    body: "Hi {{name}},\n\nGood news — your ORYNO account has been reactivated. You can sign in and use your wallet as usual.",
    ctaLabel: "Open wallet",
    ctaHref: "/cards",
    notificationType: "success",
  },
  {
    id: "wallet_promo",
    label: "Wallet / promo",
    description: "Promote funding, gift cards, or a campaign",
    subject: "Something new on ORYNO for you",
    title: "A quick update from ORYNO",
    body: "Hi {{name}},\n\nWe have an update for you. Open ORYNO to fund your wallet, pay bills, or grab the latest offers.",
    ctaLabel: "Open ORYNO",
    ctaHref: "/dashboard",
    notificationType: "promo",
  },
  {
    id: "app_maintenance",
    label: "App maintenance",
    description: "Broadcast planned downtime or maintenance",
    subject: "Scheduled maintenance on ORYNO",
    title: "Scheduled maintenance",
    body: "Hi {{name}},\n\nORYNO will undergo scheduled maintenance. Some services may be temporarily unavailable during this window.\n\nWe’re working to keep the downtime short — thank you for your patience.",
    ctaLabel: "Status & support",
    ctaHref: "/support",
    notificationType: "system",
  },
  {
    id: "security_alert",
    label: "Security alert",
    description: "Urgent security message for one or many users",
    subject: "Important security notice for your ORYNO account",
    title: "Security notice",
    body: "Hi {{name}},\n\nThis is an important security notice about your ORYNO account. Please review your recent activity and update your password if anything looks unfamiliar.",
    ctaLabel: "Secure account",
    ctaHref: "/settings/security",
    notificationType: "security",
  },
  {
    id: "feature_update",
    label: "Feature update",
    description: "Announce a product update to users",
    subject: "What’s new on ORYNO",
    title: "What’s new",
    body: "Hi {{name}},\n\nWe’ve shipped updates to make ORYNO faster and easier to use. Open the app to explore what’s new.",
    ctaLabel: "Explore ORYNO",
    ctaHref: "/dashboard",
    notificationType: "promo",
  },
];

export function getAdminEmailTemplate(id: string | null | undefined) {
  return (
    ADMIN_EMAIL_TEMPLATES.find((t) => t.id === id) ||
    ADMIN_EMAIL_TEMPLATES[0]
  );
}

export function applyTemplateVars(
  text: string,
  vars: { name?: string | null; email?: string | null },
) {
  const first = (vars.name || "there").trim().split(/\s+/)[0] || "there";
  return text
    .replace(/\{\{name\}\}/gi, first)
    .replace(/\{\{fullName\}\}/gi, vars.name?.trim() || first)
    .replace(/\{\{email\}\}/gi, vars.email?.trim() || "");
}
