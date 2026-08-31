"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mail,
  Phone,
  Search,
  SearchX,
  Smartphone,
  Sparkles,
  Trophy,
  TrendingUp,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";
import { AdCarousel } from "@/components/app/ad-carousel";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServicesSkeleton } from "@/components/app/services-skeleton";
import { useCountry } from "@/components/providers/country-provider";
import {
  filterServices,
  getServicesDirectory,
  serviceCategories,
  type ServiceDirectoryItem,
} from "@/lib/services-directory";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon | typeof GiftCardIcon> = {
  airtime: Smartphone,
  data: Wifi,
  bills: Zap,
  betting: Trophy,
  social: TrendingUp,
  "virtual-numbers": Phone,
  emails: Mail,
  "gift-cards": GiftCardIcon,
};

type ApiService = Omit<ServiceDirectoryItem, "icon"> & {
  icon: string;
  stats: string | null;
};

export default function ServicesPage() {
  const searchParams = useSearchParams();
  const { country } = useCountry();
  const [services, setServices] = useState<ServiceDirectoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof serviceCategories)[number]>(
    "All",
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/services", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { services: ApiService[] };
      setServices(
        json.services.map((s) => ({
          ...s,
          stats: s.stats ?? undefined,
          icon: ICON_MAP[s.icon] ?? Sparkles,
        })),
      );
    } catch {
      // Local fallback — still fast
      setServices(getServicesDirectory(country.code));
    } finally {
      setLoading(false);
    }
  }, [country.code]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setQuery(q);
  }, [searchParams]);

  const visible = useMemo(
    () => filterServices(services ?? [], { query, category }),
    [services, query, category],
  );

  const popularCount = (services ?? []).filter((s) => s.popular).length;

  return (
    <AppShell>
      <PageHeader
        title="All Services"
        subtitle="One app. Endless possibilities."
        backHref="/dashboard"
      />

      {loading || !services ? (
        <ServicesSkeleton />
      ) : (
        <>
          <MotionSection className="overflow-hidden rounded-[20px] border border-border bg-background shadow-[var(--shadow-soft)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] px-3.5 py-2.5 text-white sm:px-4 sm:py-3">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-8 -right-6 h-24 w-24 rounded-full bg-white/15 blur-2xl"
              />
              <div className="relative flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold tracking-[0.12em] text-white/75 uppercase">
                    Catalog · {services.length} services
                  </p>
                  <p className="truncate text-xs text-white/85">
                    Airtime, data, bills, betting, boosting, numbers
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold text-[#ffd29a] ring-1 ring-white/20">
                  {popularCount} popular
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-3.5">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search airtime, Bet9ja, DStv…"
                  className="h-9 w-full rounded-[12px] border border-border bg-muted/40 pr-3 pl-9 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
                />
              </div>

              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {serviceCategories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition sm:text-xs",
                      category === item
                        ? "bg-oryno-charcoal text-white"
                        : "bg-muted text-muted-foreground hover:bg-oryno-orange-muted hover:text-primary",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </MotionSection>

          <div className="mt-3 sm:mt-4">
            <AnimatePresence mode="wait">
              {visible.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex flex-col items-center rounded-[28px] border border-border bg-background px-6 py-14 text-center shadow-[var(--shadow-soft)]"
                >
                  <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                    <SearchX className="h-6 w-6" />
                  </span>
                  <p className="text-lg font-bold text-foreground">
                    No services found
                  </p>
                  <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                    Try another keyword or clear filters to browse the full
                    catalog.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setCategory("All");
                    }}
                    className="btn-secondary mt-5 h-11 px-5 text-sm"
                  >
                    Clear search
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key={`${category}-${query}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5"
                >
                  {visible.map((item, index) => (
                    <ServiceCard key={item.id} item={item} index={index} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AdCarousel
            placement="services_carousel"
            reserveSpaceWhileLoading={false}
            className="mt-5 sm:mt-6 lg:min-h-0 lg:h-[148px]"
          />
        </>
      )}
    </AppShell>
  );
}

function ServiceCard({
  item,
  index,
}: {
  item: ServiceDirectoryItem;
  index: number;
}) {
  const Icon = item.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.045, 0.35),
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="h-full"
    >
      <Link
        href={item.href}
        className="group flex h-full flex-col items-center justify-center gap-2.5 px-1 py-2 text-center sm:gap-3 sm:py-3"
      >
        <motion.span
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_22px_rgba(0,0,0,0.16)] ring-1 ring-white/20 sm:h-16 sm:w-16"
          style={{
            background: `linear-gradient(145deg, ${item.accent}, #e85d00)`,
          }}
          whileHover={{ rotate: [-2, 2, 0] }}
          transition={{ duration: 0.45 }}
        >
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.75} />
        </motion.span>

        <p className="text-[13px] leading-tight font-bold tracking-tight text-foreground sm:text-sm">
          {item.label}
        </p>
      </Link>
    </motion.div>
  );
}
