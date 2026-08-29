"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { ServiceLogo } from "@/components/app/service-logo";
import { cn } from "@/lib/utils";

export type SelectSheetOption = {
  id: string;
  title: string;
  subtitle?: string;
  trailing?: string;
  image?: string | null;
  domain?: string | null;
  imageFallbacks?: string[] | null;
};

type SelectSheetProps = {
  label: string;
  title: string;
  subtitle?: string;
  hint?: string;
  value: string;
  valueLabel?: string;
  valueImage?: string | null;
  onChange: (id: string) => void;
  options: SelectSheetOption[];
  loading?: boolean;
  emptyText?: string;
  headerExtra?: ReactNode;
  className?: string;
};

/** Mobile-first bottom sheet picker (matches Expo SelectSheet). */
export function SelectSheet({
  label,
  title,
  subtitle,
  hint = "Tap to choose",
  value,
  valueLabel,
  valueImage,
  onChange,
  options,
  loading,
  emptyText = "Nothing to show",
  headerExtra,
  className,
}: SelectSheetProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <div className={className}>
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className={cn(
          "flex w-full items-center gap-3 rounded-[16px] border border-border bg-muted/40 px-3.5 py-3 text-left transition hover:border-primary/35 hover:bg-oryno-orange-muted/30",
          loading && "opacity-70",
        )}
      >
        {valueImage !== undefined || selected?.image ? (
          <ServiceLogo
            src={valueImage ?? selected?.image}
            alt={valueLabel ?? selected?.title ?? label}
            domain={selected?.domain}
            fallbacks={selected?.imageFallbacks}
            fallback={valueLabel ?? selected?.title ?? "?"}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
            {loading
              ? "Loading…"
              : valueLabel || selected?.title || hint}
          </p>
          {!loading && (selected?.subtitle || (!valueLabel && !selected)) ? (
            <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
              {selected?.subtitle || hint}
            </p>
          ) : null}
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: 48, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 28, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="relative z-10 flex max-h-[82vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-border/60 bg-background shadow-[0_24px_80px_rgba(28,28,30,0.28)] sm:max-w-md sm:rounded-[28px]"
            >
              <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
              <div className="border-b border-border/70 px-5 py-4">
                <p className="text-base font-bold text-foreground">{title}</p>
                {subtitle ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                ) : null}
                {headerExtra ? <div className="mt-3">{headerExtra}</div> : null}
              </div>
              <div className="max-h-[60vh] space-y-1 overflow-y-auto p-3">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-[16px] bg-muted"
                    />
                  ))
                ) : options.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </p>
                ) : (
                  options.map((option, index) => {
                    const active = option.id === value;
                    return (
                      <motion.button
                        key={option.id}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.02, 0.2) }}
                        onClick={() => {
                          onChange(option.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-[16px] px-3.5 py-3 text-left transition",
                          active
                            ? "bg-oryno-orange-muted text-primary"
                            : "hover:bg-muted/70",
                        )}
                      >
                        {option.image !== undefined ? (
                          <ServiceLogo
                            src={option.image}
                            alt={option.title}
                            domain={option.domain}
                            fallbacks={option.imageFallbacks}
                            fallback={option.title}
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">
                            {option.title}
                          </p>
                          {option.subtitle ? (
                            <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
                              {option.subtitle}
                            </p>
                          ) : null}
                        </div>
                        {option.trailing ? (
                          <span className="shrink-0 text-xs font-bold text-primary">
                            {option.trailing}
                          </span>
                        ) : null}
                        {active ? (
                          <Check className="h-4 w-4 shrink-0 text-primary" />
                        ) : null}
                      </motion.button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
