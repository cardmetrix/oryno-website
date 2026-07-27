import { cn } from "@/lib/utils";

type GiftCardIconProps = {
  className?: string;
  strokeWidth?: number;
};

/**
 * Gift card icon: rounded card + ribbon cross + bow.
 * Uses currentColor so parent text color (e.g. orange) tints the whole icon.
 */
export function GiftCardIcon({
  className,
  strokeWidth = 1.75,
}: GiftCardIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden="true"
    >
      {/* Card */}
      <rect
        x="3"
        y="6.5"
        width="18"
        height="11"
        rx="2.4"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      {/* Vertical ribbon */}
      <path
        d="M9.25 6.5v11"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Horizontal ribbon */}
      <path
        d="M3 11.25h18"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Left bow loop */}
      <path
        d="M9.25 11.25c-1.7-1.55-3.35-1.35-3.55-.15-.15.95.95 1.55 2.05 1.1"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right bow loop */}
      <path
        d="M9.25 11.25c1.7-1.55 3.35-1.35 3.55-.15.15.95-.95 1.55-2.05 1.1"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center knot */}
      <circle cx="9.25" cy="11.25" r="1" fill="currentColor" />
    </svg>
  );
}


