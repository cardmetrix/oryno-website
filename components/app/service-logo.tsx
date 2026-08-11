"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type ServiceLogoProps = {
  src?: string | null;
  alt: string;
  fallback?: string;
  className?: string;
  imgClassName?: string;
};

/** Provider logo from VTpass CDN with letter fallback. */
export function ServiceLogo({
  src,
  alt,
  fallback,
  className,
  imgClassName,
}: ServiceLogoProps) {
  const [failed, setFailed] = useState(false);
  const letter = (fallback || alt).trim().slice(0, 1).toUpperCase() || "?";

  if (!src || failed) {
    return (
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full bg-oryno-orange-muted text-sm font-bold text-primary",
          className,
        )}
      >
        {letter}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full rounded-full object-contain p-1", imgClassName)}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    </span>
  );
}
