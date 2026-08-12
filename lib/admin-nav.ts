import {
  BadgeCheck,
  BarChart3,
  Bell,
  CreditCard,
  Gift,
  Globe2,
  Headphones,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  LineChart,
  PanelsTopLeft,
  Phone,
  Settings2,
  Smartphone,
  Tags,
  Users,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/support", label: "Support", icon: Headphones },
  { href: "/admin/waitlist", label: "USD Card Waitlist", icon: CreditCard },
  { href: "/admin/transaction-pins", label: "Transaction PINs", icon: KeyRound },
  { href: "/admin/kyc", label: "KYC", icon: BadgeCheck },
  { href: "/admin/wallets", label: "Wallets", icon: Wallet },
  { href: "/admin/gift-cards", label: "Gift Cards", icon: Gift },
  { href: "/admin/virtual-numbers", label: "Virtual Numbers", icon: Phone },
  { href: "/admin/providers", label: "Providers", icon: Wifi },
  { href: "/admin/pricing", label: "Pricing", icon: Tags },
  { href: "/admin/bills", label: "Bill Providers", icon: Zap },
  { href: "/admin/referrals", label: "Referrals", icon: BarChart3 },
  { href: "/admin/notifications", label: "Email & Alerts", icon: Bell },
  { href: "/admin/ads", label: "Ads", icon: ImageIcon },
  { href: "/admin/landing", label: "Landing images", icon: PanelsTopLeft },
  { href: "/admin/onboarding", label: "Onboarding", icon: Smartphone },
  { href: "/admin/countries", label: "Countries", icon: Globe2 },
  { href: "/admin/gateways", label: "Gateways", icon: CreditCard },
  { href: "/admin/reports", label: "Reports", icon: LineChart },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

export function isAdminNavActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
