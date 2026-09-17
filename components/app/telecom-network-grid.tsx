"use client";

import { motion } from "framer-motion";
import { ServiceLogo } from "@/components/app/service-logo";
import { cn } from "@/lib/utils";
import type { VtpassServiceOption } from "@/components/app/vtpass-service-picker";

type Props = {
  services: VtpassServiceOption[];
  value: string;
  onChange: (serviceID: string) => void;
  loading?: boolean;
  className?: string;
};

/** Compact logo tiles matching the Buy Data / Airtime network row. */
export function TelecomNetworkGrid({
  services,
  value,
  onChange,
  loading,
  className,
}: Props) {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-4 gap-2.5 sm:gap-3", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    );
  }

  if (!services.length) {
    return (
      <p className="rounded-2xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
        No networks available
      </p>
    );
  }

  const cols =
    services.length <= 2
      ? "grid-cols-2"
      : services.length === 3
        ? "grid-cols-3"
        : "grid-cols-4";

  return (
    <div className={cn("grid gap-2.5 sm:gap-3", cols, className)}>
      {services.map((service, index) => {
        const selected = value === service.serviceID;
        return (
          <motion.button
            key={service.serviceID}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.28 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(service.serviceID)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl px-2 py-3 transition-colors sm:py-3.5",
              selected
                ? "border-2 border-primary bg-oryno-orange-muted/40"
                : "border-2 border-transparent bg-muted hover:bg-muted/80",
            )}
          >
            <ServiceLogo
              src={service.image}
              alt={service.name}
              domain={service.domain}
              fallbacks={service.imageFallbacks}
              fallback={service.name}
              className="h-11 w-11 rounded-xl bg-background sm:h-12 sm:w-12"
              imgClassName="rounded-xl p-1.5"
            />
            <span
              className={cn(
                "max-w-full truncate text-[11px] font-bold uppercase tracking-wide sm:text-xs",
                selected ? "text-primary" : "text-foreground",
              )}
            >
              {service.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
