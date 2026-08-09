"use client";

import { motion } from "framer-motion";
import { fadeUp, stagger } from "./motion";
import { PhoneFrame } from "./phone-frame";

type Shot = {
  label: string;
  alt: string;
  file: string;
  src?: string;
};

type ScreenshotsProps = {
  shots: Shot[];
};

export function Screenshots({ shots }: ScreenshotsProps) {
  return (
    <section id="screenshots" className="surface-white py-24 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 md:max-w-none md:px-0">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.p variants={fadeUp} className="eyebrow">
            Inside the app
          </motion.p>
          <motion.h2 variants={fadeUp} className="section-title">
            Clean screens. Confident actions.
          </motion.h2>
          <motion.p variants={fadeUp} className="section-copy mx-auto mt-3">
            Real product screens — wallet, gift cards, data, bills, numbers, and
            more.
          </motion.p>
        </motion.div>

        <div className="mt-14 grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-3 lg:grid-cols-4">
          {shots.map((shot, index) => (
            <motion.div
              key={shot.file}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.5,
                delay: Math.min(index * 0.06, 0.36),
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -10, rotate: index % 2 === 0 ? -1.5 : 1.5 }}
              className="flex flex-col items-center"
            >
              <PhoneFrame
                alt={shot.alt}
                label={shot.label}
                src={shot.src}
                fileName={shot.file}
                className="w-full max-w-[220px]"
                priority={index < 2}
              />
              <p className="mt-4 text-sm font-medium text-foreground">
                {shot.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
