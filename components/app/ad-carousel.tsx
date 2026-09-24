"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { isExternalAdHref, type AdPlacement } from "@/lib/admin/ads";
import { cn } from "@/lib/utils";

type AdSlide = {
  id: string;
  href: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  overlay: string;
  badge?: string | null;
};

const INTERVAL_MS = 10_000;
const DEFAULT_OVERLAY =
  "from-oryno-charcoal/85 via-oryno-charcoal/40 to-transparent";

type AdCarouselProps = {
  placement?: AdPlacement;
  className?: string;
  /** When false, render nothing while loading (services screen). */
  reserveSpaceWhileLoading?: boolean;
};

export function AdCarousel({
  placement = "home_carousel",
  className,
  reserveSpaceWhileLoading = true,
}: AdCarouselProps) {
  const [ads, setAds] = useState<AdSlide[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const res = await fetch(`/api/ads?placement=${placement}`, {
          next: { revalidate: 60 },
        });
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as {
          ads?: Array<{
            id: string;
            href: string;
            title: string;
            subtitle: string | null;
            imageUrl: string;
            overlay?: string;
            badge?: string | null;
          }>;
        };
        if (cancelled) return;
        setAds(
          (json.ads ?? []).map((ad) => ({
            id: ad.id,
            href: ad.href,
            title: ad.title,
            subtitle: ad.subtitle,
            imageUrl: ad.imageUrl,
            overlay: ad.overlay || DEFAULT_OVERLAY,
            badge: ad.badge,
          })),
        );
        setIndex(0);
      } catch {
        if (!cancelled) setAds([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placement]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [ads.length]);

  if (!loaded) {
    if (!reserveSpaceWhileLoading) return null;
    return (
      <div
        className={cn(
          "h-[112px] w-full animate-pulse rounded-[20px] border border-border/80 bg-muted sm:h-[124px] md:h-[132px] md:rounded-[22px]",
          className,
        )}
      />
    );
  }

  if (ads.length === 0) return null;

  const safeIndex = index % ads.length;
  const ad = ads[safeIndex];
  const remote = /^https?:\/\//i.test(ad.imageUrl);

  return (
    <div
      className={cn(
        "ad-carousel relative h-[112px] w-full overflow-hidden rounded-[20px] border border-border/80 bg-muted shadow-[var(--shadow-soft)] sm:h-[124px] md:h-[132px] md:rounded-[22px]",
        className,
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={ad.id}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <Image
            src={ad.imageUrl}
            alt={ad.title}
            fill
            className="object-cover object-[center_30%] md:object-center"
            sizes="(max-width: 1024px) 100vw, 40vw"
            priority={safeIndex === 0}
            unoptimized={remote}
          />
          <div className={`absolute inset-0 bg-gradient-to-r ${ad.overlay}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />

          <AdLink
            href={ad.href}
            className="group absolute inset-0 flex items-end justify-between gap-3 p-3 sm:p-3.5 md:p-3.5"
          >
            <div className="min-w-0 max-w-[90%]">
              {ad.badge ? (
                <span className="mb-1 inline-block rounded-md bg-primary/95 px-2 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase">
                  {ad.badge}
                </span>
              ) : null}
              <p className="truncate text-base font-bold tracking-tight text-white sm:text-lg md:text-xl">
                {ad.title}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-white/80 sm:text-sm">
                {ad.subtitle}
              </p>
            </div>

            <span className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm transition group-hover:border-white/40 group-hover:bg-white/25 sm:h-10 sm:w-10">
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </AdLink>
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-x-0 top-0 h-0.5 bg-black/20">
        <motion.div
          key={`progress-${ad.id}`}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: INTERVAL_MS / 1000, ease: "linear" }}
          className="h-full bg-primary"
        />
      </div>

      <div className="absolute top-2 right-2 flex gap-1 sm:top-2.5 sm:right-2.5">
        {ads.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Go to ad ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === safeIndex
                ? "w-4 bg-white"
                : "w-1.5 bg-white/45 hover:bg-white/70"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function AdLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (isExternalAdHref(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
