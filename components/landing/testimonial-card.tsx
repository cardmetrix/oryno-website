"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { StarRating } from "@/components/landing/star-rating";
import type { PublicTestimonial } from "@/lib/testimonials";
import { cn } from "@/lib/utils";

type TestimonialCardProps = {
  review: PublicTestimonial;
  className?: string;
  compact?: boolean;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function TestimonialCard({
  review,
  className,
  compact = false,
}: TestimonialCardProps) {
  return (
    <motion.article
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={cn(
        "group relative flex h-full min-h-[220px] w-[min(88vw,320px)] shrink-0 flex-col rounded-[24px] border border-border/70 bg-background/95 p-5 shadow-[0_18px_50px_rgba(28,28,30,0.08)] backdrop-blur-sm sm:w-[320px]",
        review.featured &&
          "border-primary/25 bg-gradient-to-br from-background via-background to-oryno-orange-muted/40 shadow-[0_22px_60px_rgba(255,106,0,0.12)]",
        compact && "min-h-[200px] p-4",
        className,
      )}
    >
      <div className="absolute top-4 right-4 text-primary/15 transition-colors group-hover:text-primary/25">
        <Quote className="h-8 w-8" strokeWidth={1.5} />
      </div>

      <StarRating value={review.rating} size="sm" className="mb-3" />

      <p
        className={cn(
          "line-clamp-5 flex-1 text-sm leading-relaxed text-foreground/90",
          compact && "line-clamp-4 text-[13px]",
        )}
      >
        “{review.body}”
      </p>

      <div className="mt-5 flex items-center gap-3 border-t border-border/60 pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#ff8a33] text-sm font-bold text-white shadow-[0_8px_20px_rgba(255,106,0,0.28)]">
          {initials(review.authorName)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {review.authorName}
          </p>
          {review.authorRole ? (
            <p className="truncate text-xs text-muted-foreground">
              {review.authorRole}
            </p>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}
