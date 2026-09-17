import {
  Activity,
  History,
  Home,
  LayoutGrid,
  Phone,
  Settings,
  Smartphone,
  Trophy,
  TrendingUp,
  Tv,
  User,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";

export const primaryNav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export const serviceNav = [
  {
    href: "/services/gift-cards/live",
    label: "Gift Card Live",
    icon: Activity,
  },
  { href: "/services/gift-cards", label: "Gift Cards", icon: GiftCardIcon },
  { href: "/services/social", label: "Social Boost", icon: TrendingUp },
  { href: "/services/virtual-numbers", label: "Numbers", icon: Phone },
  { href: "/services/airtime", label: "Airtime", icon: Smartphone },
  { href: "/services/data", label: "Data", icon: Wifi },
  { href: "/services/bills", label: "TV Bills", icon: Tv },
  { href: "/services/electricity", label: "Electricity", icon: Zap },
  { href: "/services/betting", label: "Betting", icon: Trophy },
  { href: "/services", label: "All Services", icon: LayoutGrid },
] as const;

export function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  // "All Services" should only highlight on the directory itself
  if (href === "/services") return pathname === "/services";
  // Keep Gift Cards and Gift Card Live as distinct active states
  if (href === "/services/gift-cards") {
    return (
      pathname === "/services/gift-cards" ||
      pathname.startsWith("/services/gift-cards?")
    );
  }
  if (href === "/services/gift-cards/live") {
    return (
      pathname === "/services/gift-cards/live" ||
      pathname.startsWith("/services/gift-cards/live/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
