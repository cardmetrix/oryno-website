"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { ServiceLogo } from "@/components/app/service-logo";
import { cn } from "@/lib/utils";

export type VtpassServiceOption = {
  serviceID: string;
  name: string;
  image?: string | null;
  minAmount?: number;
  maxAmount?: number;
};

type Props = {
  services: VtpassServiceOption[];
  value: string;
  onChange: (serviceID: string) => void;
  loading?: boolean;
  className?: string;
  columns?: string;
};

export function VtpassServicePicker({
  services,
  value,
  onChange,
  loading,
  className,
  columns = "grid-cols-2 sm:grid-cols-4",
}: Props) {
  if (loading) {
    return (
      <div className={cn("grid gap-3", columns, className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-[18px] bg-muted"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", columns, className)}>
      {services.map((service, index) => {
        const selected = value === service.serviceID;
        return (
          <motion.button
            key={service.serviceID}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.3 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(service.serviceID)}
            className={cn(
              "relative overflow-hidden rounded-[18px] border px-3 py-3.5 text-left transition-colors",
              selected
                ? "border-primary bg-oryno-orange-muted shadow-[var(--shadow-soft)]"
                : "border-border bg-background hover:bg-muted/60",
            )}
          >
            <div className="relative z-10 flex items-center gap-2.5">
              <ServiceLogo
                src={service.image}
                alt={service.name}
                fallback={service.name}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {service.name.replace(/\s+(VTU|Data|Payment|Subscription).*$/i, "")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {selected ? "Selected" : "Tap to select"}
                </p>
              </div>
              {selected ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              ) : null}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
