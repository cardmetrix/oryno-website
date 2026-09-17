"use client";

import Image from "next/image";
import { useId } from "react";
import { cn } from "@/lib/utils";

export const BRAND_ICON_SRC = "/brand/oryno-icon.png";

type OrynoRefreshIconProps = {
  /** 0–1 pull progress; when refreshing, treat as spinning. */
  progress?: number;
  refreshing?: boolean;
  size?: number;
  className?: string;
};

/**
 * Custom pull-to-refresh indicator: ORYNO mark in the center with a
 * soft track + spinning orange arc (same pattern as branded mobile apps).
 */
export function OrynoRefreshIcon({
  progress = 0,
  refreshing = false,
  size = 44,
  className,
}: OrynoRefreshIconProps) {
  const gradId = useId().replace(/:/g, "");
  const p = Math.max(0, Math.min(1, progress));
  const active = refreshing || p > 0.02;
  const iconSize = Math.round(size * 0.52);
  const stroke = Math.max(2.5, size * 0.07);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arcLen = refreshing ? c * 0.72 : c * (0.18 + p * 0.54);
  const rotate = refreshing ? undefined : p * 270;

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        active ? "opacity-100" : "opacity-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        filter: active
          ? "drop-shadow(0 6px 14px rgba(255, 106, 0, 0.28))"
          : undefined,
      }}
      aria-hidden={!active}
    >
      <span
        className="absolute inset-[-6px] rounded-full bg-primary/10"
        style={{ opacity: refreshing ? 1 : 0.35 + p * 0.65 }}
      />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-primary/20"
        />
      </svg>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn(
          "absolute inset-0 text-primary",
          refreshing && "animate-[oryno-refresh-spin_0.85s_linear_infinite]",
        )}
        style={
          refreshing ? undefined : { transform: `rotate(${rotate - 90}deg)` }
        }
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${c}`}
          strokeDashoffset={0}
        />
      </svg>

      <span
        className={cn(
          "relative z-10 overflow-hidden rounded-full bg-background shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-black/5",
          refreshing &&
            "animate-[oryno-refresh-pulse_1.1s_ease-in-out_infinite]",
        )}
        style={{ width: iconSize, height: iconSize }}
      >
        <Image
          src={BRAND_ICON_SRC}
          alt=""
          width={iconSize}
          height={iconSize}
          className="h-full w-full object-cover"
          priority={false}
        />
      </span>
    </div>
  );
}
