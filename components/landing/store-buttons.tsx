"use client";

import { motion } from "framer-motion";
import { STORE_LINKS } from "@/lib/store-links";
import { cn } from "@/lib/utils";

type StoreButtonsProps = {
  className?: string;
  size?: "compact" | "default" | "large";
  /** Use on orange/brand backgrounds */
  variant?: "default" | "onBrand";
  layout?: "row" | "column";
};

export function StoreButtons({
  className,
  size = "default",
  variant = "default",
  layout = "row",
}: StoreButtonsProps) {
  const isLarge = size === "large";
  const isCompact = size === "compact";
  const onBrand = variant === "onBrand";

  return (
    <div
      className={cn(
        "flex",
        layout === "column"
          ? "w-full flex-col gap-3"
          : "w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5",
        className,
      )}
    >
      <motion.a
        href={STORE_LINKS.playStore}
        aria-label="Get it on Google Play"
        whileHover={{ y: isCompact ? -1 : -3, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className={cn(
          "store-badge group flex w-full items-center justify-center sm:w-auto sm:justify-start",
          onBrand && "store-badge-on-brand",
          isCompact && "min-w-0 px-2.5 py-1.5",
          !isCompact && (isLarge ? "min-w-0 px-4 py-3 sm:min-w-[200px]" : "min-w-0 px-3.5 py-2.5 sm:min-w-[180px]"),
        )}
      >
        <div className={cn("flex items-center", isCompact ? "gap-2" : "gap-3.5")}>
          <GooglePlayIcon
            className={cn(isCompact ? "h-5 w-5" : isLarge ? "h-9 w-9" : "h-8 w-8")}
          />
          <div className="flex flex-col text-left">
            {!isCompact ? (
              <p
                className={cn(
                  "text-sm",
                  onBrand ? "text-white/75" : "text-muted-foreground",
                )}
              >
                Download our app
              </p>
            ) : null}
            <h4
              className={cn(
                "font-semibold tracking-tight",
                isCompact ? "text-xs" : isLarge ? "text-lg" : "text-base",
                onBrand ? "text-white" : "text-foreground",
              )}
            >
              {isCompact ? "Play" : "Google Play"}
            </h4>
          </div>
        </div>
      </motion.a>

      <motion.a
        href={STORE_LINKS.appStore}
        aria-label="Download on the App Store"
        whileHover={{ y: isCompact ? -1 : -3, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className={cn(
          "store-badge group flex w-full items-center justify-center sm:w-auto sm:justify-start",
          onBrand && "store-badge-on-brand",
          isCompact && "min-w-0 px-2.5 py-1.5",
          !isCompact && (isLarge ? "min-w-0 px-4 py-3 sm:min-w-[200px]" : "min-w-0 px-3.5 py-2.5 sm:min-w-[180px]"),
        )}
      >
        <div className={cn("flex items-center", isCompact ? "gap-2" : "gap-3.5")}>
          <AppleStoreIcon
            className={cn(
              isCompact ? "h-5 w-5" : isLarge ? "h-9 w-9" : "h-8 w-8",
              onBrand ? "fill-white" : "fill-foreground",
            )}
          />
          <div className="flex flex-col text-left">
            {!isCompact ? (
              <p
                className={cn(
                  "text-sm",
                  onBrand ? "text-white/75" : "text-muted-foreground",
                )}
              >
                Download our app
              </p>
            ) : null}
            <h4
              className={cn(
                "font-semibold tracking-tight",
                isCompact ? "text-xs" : isLarge ? "text-lg" : "text-base",
                onBrand ? "text-white" : "text-foreground",
              )}
            >
              {isCompact ? "App Store" : "App Store"}
            </h4>
          </div>
        </div>
      </motion.a>
    </div>
  );
}

function GooglePlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#32BBFF"
        d="M382.369,175.623C322.891,142.356,227.427,88.937,79.355,6.028C69.372-0.565,57.886-1.429,47.962,1.93l254.05,254.05L382.369,175.623z"
      />
      <path
        fill="#32BBFF"
        d="M47.962,1.93c-1.86,0.63-3.67,1.39-5.401,2.308C31.602,10.166,23.549,21.573,23.549,36v439.96c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314L302.012,255.98L47.962,1.93z"
      />
      <path
        fill="#32BBFF"
        d="M302.012,255.98L47.956,510.035c9.927,3.384,21.413,2.586,31.399-4.103c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L302.012,255.98z"
      />
      <path
        fill="#2C9FD9"
        d="M23.549,255.98v219.98c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314L302.012,255.98H23.549z"
      />
      <path
        fill="#29CC5E"
        d="M79.355,6.028C67.5-1.8,53.52-1.577,42.561,4.239l255.595,255.596l84.212-84.212C322.891,142.356,227.427,88.937,79.355,6.028z"
      />
      <path
        fill="#D93F21"
        d="M298.158,252.126L42.561,507.721c10.96,5.815,24.939,6.151,36.794-1.789c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L298.158,252.126z"
      />
      <path
        fill="#FFD500"
        d="M488.45,255.98c0-12.19-6.151-24.492-18.342-31.314c0,0-22.799-12.721-92.682-51.809l-83.123,83.123l83.204,83.205c69.116-38.807,92.6-51.892,92.6-51.892C482.299,280.472,488.45,268.17,488.45,255.98z"
      />
      <path
        fill="#FFAA00"
        d="M470.108,287.294c12.191-6.822,18.342-19.124,18.342-31.314H294.303l83.204,83.205C446.624,300.379,470.108,287.294,470.108,287.294z"
      />
    </svg>
  );
}

function AppleStoreIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
    </svg>
  );
}
