import {
  Gift,
  History,
  Home,
  LayoutGrid,
  Phone,
  Settings,
  Smartphone,
  TrendingUp,
  User,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";

export const primaryNav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export const serviceNav = [
  { href: "/services/airtime", label: "Airtime", icon: Smartphone },
  { href: "/services/data", label: "Data", icon: Wifi },
  { href: "/services/bills", label: "Bills", icon: Zap },
  { href: "/services/social", label: "Social Boost", icon: TrendingUp },
  { href: "/services/gift-cards", label: "Gift Cards", icon: Gift },
  { href: "/services/virtual-numbers", label: "Numbers", icon: Phone },
  { href: "/services", label: "All Services", icon: LayoutGrid },
] as const;

export function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
