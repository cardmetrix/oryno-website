"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PenLine, Star } from "lucide-react";
import { TestimonialMarquee } from "@/components/landing/testimonial-marquee";
import { WriteReviewForm } from "@/components/landing/write-review-form";
import { fadeUp, stagger } from "@/components/landing/motion";
import type { PublicTestimonial } from "@/lib/testimonials";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TestimonialsProps = {
  reviews: PublicTestimonial[];
  stats: {
    count: number;
    averageRating: number;
  };
};

export function Testimonials({ reviews, stats }: TestimonialsProps) {
  const [open, setOpen] = useState(false);

  return (
    <section id="testimonials" className="relative overflow-hidden py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.08),transparent_42%),radial-gradient(circle_at_bottom,rgba(255,106,0,0.05),transparent_35%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-6 md:max-w-none">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.p variants={fadeUp} className="eyebrow">
            Loved by users
          </motion.p>
          <motion.h2 variants={fadeUp} className="section-title">
            Real stories. Real ratings.
          </motion.h2>
          <motion.p variants={fadeUp} className="section-copy mx-auto mt-3">
            See what people say about ORYNO — then share your own review for
            our team to approve and showcase.
          </motion.p>

          {stats.count > 0 ? (
            <motion.div
              variants={fadeUp}
              className="mt-8 inline-flex flex-wrap items-center justify-center gap-4 rounded-full border border-border/80 bg-background/80 px-5 py-3 shadow-[0_10px_40px_rgba(28,28,30,0.06)] backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
                  <Star className="h-5 w-5 fill-current" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold leading-none text-foreground">
                    {stats.averageRating.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">Average rating</p>
                </div>
              </div>
              <div className="hidden h-8 w-px bg-border sm:block" />
              <div className="text-left">
                <p className="text-lg font-bold leading-none text-foreground">
                  {stats.count}+
                </p>
                <p className="text-xs text-muted-foreground">Approved reviews</p>
              </div>
            </motion.div>
          ) : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-14"
        >
          <TestimonialMarquee reviews={reviews} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 flex justify-center"
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_14px_36px_rgba(255,106,0,0.28)] transition hover:brightness-105"
          >
            <PenLine className="h-4 w-4" />
            Write a review
          </button>
        </motion.div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border/80 p-0 sm:max-w-lg sm:rounded-[28px]">
          <DialogHeader className="border-b border-border/70 px-6 pt-6 pb-4 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight">
              Write a review
            </DialogTitle>
            <DialogDescription>
              Share your ORYNO experience. Reviews appear after admin approval.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            <WriteReviewForm
              embedded
              onSubmitted={() => {
                window.setTimeout(() => setOpen(false), 1800);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
