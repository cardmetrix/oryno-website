"use client";

import { useMemo } from "react";
import { TestimonialCard } from "@/components/landing/testimonial-card";
import type { PublicTestimonial } from "@/lib/testimonials";
import { cn } from "@/lib/utils";

type TestimonialMarqueeProps = {
  reviews: PublicTestimonial[];
  className?: string;
};

function MarqueeRow({
  reviews,
  reverse = false,
  duration = 90,
}: {
  reviews: PublicTestimonial[];
  reverse?: boolean;
  duration?: number;
}) {
  const loop = useMemo(() => [...reviews, ...reviews], [reviews]);

  return (
    <div className="group/marquee relative overflow-hidden py-2">
      <div
        className={cn(
          "flex w-max gap-4 will-change-transform",
          reverse ? "animate-marquee-reverse" : "animate-marquee",
        )}
        style={{
          animationDuration: `${duration}s`,
        }}
      >
        {loop.map((review, index) => (
          <TestimonialCard
            key={`${review.id}-${index}`}
            review={review}
            compact
          />
        ))}
      </div>
    </div>
  );
}

export function TestimonialMarquee({
  reviews,
  className,
}: TestimonialMarqueeProps) {
  if (!reviews.length) {
    return (
      <div
        className={cn(
          "rounded-[28px] border border-dashed border-border/80 bg-muted/30 px-6 py-16 text-center",
          className,
        )}
      >
        <p className="text-lg font-semibold text-foreground">
          Reviews are on the way
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Be the first to share your ORYNO experience — approved reviews appear
          here in a live scrolling showcase.
        </p>
      </div>
    );
  }

  const topRow = reviews.filter((_, index) => index % 2 === 0);
  const bottomRow = reviews.filter((_, index) => index % 2 === 1);
  const rowA = topRow.length ? topRow : reviews;
  const rowB = bottomRow.length ? bottomRow : reviews;

  return (
    <div className={cn("relative space-y-4", className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-24" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-24" />

      <MarqueeRow reviews={rowA} duration={110} />
      <MarqueeRow reviews={rowB} reverse duration={95} />
    </div>
  );
}
