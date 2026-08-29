"use client";

import { useEffect, useMemo, useState } from "react";
import { serviceLogoSources } from "@/lib/brand-logos";
import { cn } from "@/lib/utils";

type ServiceLogoProps = {
  src?: string | null;
  alt: string;
  domain?: string | null;
  fallbacks?: string[] | null;
  fallback?: string;
  className?: string;
  imgClassName?: string;
};

/** Provider logo with open favicon/logo API fallbacks, then a letter. */
export function ServiceLogo({
  src,
  alt,
  domain,
  fallbacks,
  fallback,
  className,
  imgClassName,
}: ServiceLogoProps) {
  const chain = useMemo(
    () =>
      serviceLogoSources({
        src,
        domain,
        name: alt,
        fallbacks,
      }),
    [src, domain, alt, fallbacks],
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [chain.join("|")]);

  const letter = (fallback || alt).trim().slice(0, 1).toUpperCase() || "?";
  const current = chain[idx];

  if (!current) {
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
        key={current}
        src={current}
        alt={alt}
        className={cn("h-full w-full rounded-full object-contain p-1", imgClassName)}
        onError={() =>
          setIdx((i) => (i + 1 < chain.length ? i + 1 : chain.length))
        }
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </span>
  );
}
