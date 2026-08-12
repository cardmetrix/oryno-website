"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function StarRating({
  value,
  onChange,
  size = "md",
  className,
}: StarRatingProps) {
  const interactive = typeof onChange === "function";
  const stars = [1, 2, 3, 4, 5];
  const selected = Math.max(0, Math.min(5, Math.round(value)));

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      role={interactive ? "radiogroup" : undefined}
      aria-label={
        selected > 0 ? `${selected} out of 5 stars` : "Rate from 1 to 5 stars"
      }
    >
      {stars.map((star) => {
        const active = selected > 0 && star <= selected;
        const starNode = (
          <Star
            data-star={star}
            className={cn(
              sizeMap[size],
              "transition-colors duration-200",
              active
                ? "fill-oryno-orange text-oryno-orange"
                : "text-muted-foreground/35",
            )}
            strokeWidth={1.75}
          />
        );

        if (!interactive) {
          return (
            <span key={star} aria-hidden="true">
              {starNode}
            </span>
          );
        }

        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={(event) => {
              const group = event.currentTarget.parentElement;
              if (!group) return;
              group.querySelectorAll("[data-star]").forEach((node) => {
                const index = Number((node as HTMLElement).dataset.star || "0");
                node.classList.toggle("text-oryno-orange", index <= star);
                node.classList.toggle("fill-oryno-orange", index <= star);
                node.classList.toggle("text-muted-foreground/35", index > star);
              });
            }}
            onMouseLeave={(event) => {
              const group = event.currentTarget.parentElement;
              if (!group) return;
              group.querySelectorAll("[data-star]").forEach((node) => {
                const index = Number((node as HTMLElement).dataset.star || "0");
                node.classList.toggle("text-oryno-orange", index <= selected);
                node.classList.toggle("fill-oryno-orange", index <= selected);
                node.classList.toggle("text-muted-foreground/35", index > selected);
              });
            }}
            className="rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={`${star} stars`}
          >
            {starNode}
          </button>
        );
      })}
    </div>
  );
}
