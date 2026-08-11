"use client";

import { useState } from "react";
import Image from "next/image";
import { giftCardImageFallbacks } from "@/lib/sogo/catalog";
import { cn } from "@/lib/utils";

function brandImageSrc(brand: { slug?: string; image: string }) {
  if (brand.image && /^https?:\/\//i.test(brand.image)) return brand.image;
  if (brand.image?.startsWith("/")) return brand.image;
  return giftCardImageFallbacks(brand.slug || "gift")[0];
}

export function GiftCardBrandLogo({
  brand,
  className,
  size = 44,
  fallbacks,
}: {
  brand: { slug?: string; image: string; name: string };
  className?: string;
  size?: number;
  fallbacks?: string[];
}) {
  const primary = brandImageSrc(brand);
  const chain = [
    primary,
    ...(fallbacks || []),
    ...(brand.slug
      ? giftCardImageFallbacks(brand.slug).filter((u) => u !== primary)
      : []),
  ].filter((u, i, arr) => u && arr.indexOf(u) === i);
  const [idx, setIdx] = useState(0);
  const src = chain[Math.min(idx, Math.max(chain.length - 1, 0))] || primary;
  const remote = /^https?:\/\//i.test(src);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-border",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        key={src}
        src={src}
        alt={brand.name}
        fill
        sizes={`${size}px`}
        className="rounded-full object-contain p-1.5"
        unoptimized={remote || src.endsWith(".svg")}
        onError={() => setIdx((i) => (i + 1 < chain.length ? i + 1 : i))}
      />
    </div>
  );
}

export function giftCardRateChangePercent(
  slug: string,
  rate: number | null,
) {
  if (rate == null || rate <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return Math.round((((hash % 700) - 200) / 100) * 100) / 100;
}
