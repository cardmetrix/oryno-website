"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Network, NetworkId, networks } from "@/lib/telecom";
import { cn } from "@/lib/utils";

type NetworkPickerProps = {
  value: NetworkId;
  onChange: (id: NetworkId) => void;
  className?: string;
};

export function NetworkPicker({
  value,
  onChange,
  className,
}: NetworkPickerProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {networks.map((network, index) => (
        <NetworkCard
          key={network.id}
          network={network}
          selected={value === network.id}
          onSelect={() => onChange(network.id)}
          delay={index * 0.04}
        />
      ))}
    </div>
  );
}

function NetworkCard({
  network,
  selected,
  onSelect,
  delay,
}: {
  network: Network;
  selected: boolean;
  onSelect: () => void;
  delay: number;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      className={cn(
        "relative overflow-hidden rounded-[18px] border px-3 py-3.5 text-left transition-colors",
        selected
          ? "border-primary bg-oryno-orange-muted shadow-[var(--shadow-soft)]"
          : "border-border bg-background hover:bg-muted/60",
      )}
    >
      {selected ? (
        <motion.span
          layoutId="network-selected"
          className="absolute inset-0 rounded-[18px] bg-oryno-orange-muted"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      ) : null}

      <div className="relative z-10 flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-oryno-charcoal"
          style={{ background: network.soft }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
            style={{ background: network.color }}
          >
            {network.name.slice(0, 1)}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {network.name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {selected ? "Selected" : "Tap to select"}
          </p>
        </div>
        {selected ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        ) : null}
      </div>
    </motion.button>
  );
}
