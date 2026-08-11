import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  size?: number;
  priority?: boolean;
};

export const BRAND_LOGO_SRC = "/brand/oryno-logo.png";

export function BrandLogo({
  className,
  size = 36,
  priority = false,
}: BrandLogoProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt="ORYNO"
        width={size}
        height={size}
        priority={priority}
        className="h-full w-full rounded-full object-cover"
      />
    </span>
  );
}
