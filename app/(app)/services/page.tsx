"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Phone,
  Search,
  SearchX,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServicesSkeleton } from "@/components/app/services-skeleton";
import {
  filterServices,
  serviceCategories,
  servicesDirectory,
  type ServiceDirectoryItem,
} from "@/lib/services-directory";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon | typeof GiftCardIcon> = {
  airtime: Smartphone,
  data: Wifi,
  bills: Zap,
  social: TrendingUp,
  "virtual-numbers": Phone,
  "gift-cards": GiftCardIcon,
};

type ApiService = Omit<ServiceDirectoryItem, "icon"> & {
  icon: string;
  stats: string | null;
};

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceDirectoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof serviceCategories)[number]>(
    "All",
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/services", { cache: "force-cache" });
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
      setServices(servicesDirectory);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
          <MotionSection className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] px-5 py-5 text-white sm:px-6 sm:py-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-10 -right-8 h-36 w-36 rounded-full bg-white/15 blur-2xl"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-white/80 uppercase">
                    <Sparkles className="h-3.5 w-3.5" />
                    Catalog
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                    {services.length} services ready
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-white/85">
                    Airtime, data, bills, boosting, numbers — search or filter
                    to jump in fast.
                  </p>
                </div>
                <span className="rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-bold text-[#ffd29a] ring-1 ring-white/20">
                  {popularCount} popular
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search airtime, DStv, Instagram…"
                  className="h-12 w-full rounded-[16px] border border-border bg-muted/40 pr-4 pl-10 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
                />
              </div>

              <div className="mt-3.5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {serviceCategories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={cn(
                      "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition sm:text-sm",
                      category === item
                        ? "bg-oryno-charcoal text-white shadow-[var(--shadow-soft)]"
                        : "bg-muted text-muted-foreground hover:bg-oryno-orange-muted hover:text-primary",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </MotionSection>

          <div className="mt-5 sm:mt-6">
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
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {visible.map((item, index) => (
                    <ServiceCard key={item.id} item={item} index={index} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.28), duration: 0.35 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Link
        href={item.href}
        className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] transition hover:border-primary/25 hover:shadow-[0_18px_40px_rgba(255,106,0,0.12)] sm:p-5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full opacity-30 blur-2xl transition group-hover:opacity-50"
          style={{ background: item.accent }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] ring-1 ring-white/20"
            style={{
              background: `linear-gradient(145deg, ${item.accent}, #e85d00)`,
            }}
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </span>

          <div className="flex flex-col items-end gap-1.5">
            {item.soon ? (
              <span className="rounded-full bg-oryno-orange-muted px-2.5 py-1 text-[10px] font-bold text-primary">
                Soon
              </span>
            ) : item.popular ? (
              <span className="rounded-full bg-oryno-charcoal px-2.5 py-1 text-[10px] font-bold text-white">
                Popular
              </span>
            ) : null}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {item.eta}
            </span>
          </div>
        </div>

        <div className="relative mt-4 flex-1">
          <p className="text-base font-bold tracking-tight text-foreground">
            {item.label}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {item.shortDescription}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground/90">
            {item.longDescription}
          </p>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="relative mt-4 flex items-center justify-between border-t border-border/80 pt-3">
          <span className="text-xs font-semibold text-foreground">
            {item.stats ?? item.category}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary transition group-hover:gap-1.5">
            Open
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
