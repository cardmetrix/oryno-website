"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { StarRating } from "@/components/landing/star-rating";
import { cn } from "@/lib/utils";

type WriteReviewFormProps = {
  className?: string;
  /** Flat layout for dialogs / modals (no outer card chrome). */
  embedded?: boolean;
  onSubmitted?: () => void;
};

export function WriteReviewForm({
  className,
  embedded = false,
  onSubmitted,
}: WriteReviewFormProps) {
  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (rating < 1) {
      toast.error("Please select a star rating");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName,
          authorRole,
          rating,
          body,
          website,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Could not submit review");
      }

      setSubmitted(true);
      setAuthorName("");
      setAuthorRole("");
      setRating(0);
      setBody("");
      toast.success(
        data.message ||
          "Review submitted! It will appear after admin approval.",
      );
      onSubmitted?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit review",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("py-6 text-center", className)}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-xl font-bold text-foreground">
          Thank you for sharing
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Your review is pending approval. Once our team verifies it, it will
          join the live testimonial wall on this page.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-6 text-sm font-semibold text-primary hover:underline"
        >
          Write another review
        </button>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        !embedded &&
          "rounded-[28px] border border-border/80 bg-background/90 p-6 shadow-[0_20px_60px_rgba(28,28,30,0.06)] backdrop-blur-sm sm:p-8",
        className,
      )}
    >
      {!embedded ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Write a review</p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              Share your ORYNO experience
            </h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-full bg-muted/60 px-4 py-2">
              <StarRating value={rating} onChange={setRating} size="lg" />
            </div>
            {rating === 0 ? (
              <p className="text-xs text-muted-foreground">
                Tap a star to rate your experience
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mb-5 flex flex-col items-start gap-2">
          <span className="text-sm font-medium text-foreground">Your rating</span>
          <div className="rounded-full bg-muted/60 px-4 py-2">
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
          {rating === 0 ? (
            <p className="text-xs text-muted-foreground">
              Tap a star to rate your experience
            </p>
          ) : null}
        </div>
      )}

      <div className={cn("grid gap-4 sm:grid-cols-2", !embedded && "mt-6")}>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">Your name</span>
          <input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Ada O."
            maxLength={120}
            required
            className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-foreground">
            Location or role{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <input
            value={authorRole}
            onChange={(event) => setAuthorRole(event.target.value)}
            placeholder="Lagos, Nigeria · Gift card trader"
            maxLength={120}
            className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-medium text-foreground">Your review</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Tell others what you love about ORYNO — wallet, gift cards, data, support..."
          minLength={12}
          maxLength={600}
          rows={5}
          required
          className="w-full resize-none rounded-[22px] border border-border bg-background px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        />
        <span className="text-xs text-muted-foreground">
          {body.length}/600 characters · min. 12
        </span>
      </label>

      <input
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        className="hidden"
        aria-hidden
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          Reviews are moderated. Only approved feedback appears on the landing
          page marquee.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_30px_rgba(255,106,0,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Submit review
        </button>
      </div>
    </form>
  );
}
