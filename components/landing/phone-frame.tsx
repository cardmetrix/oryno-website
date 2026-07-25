import Image from "next/image";
import { BRAND_LOGO_SRC } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

type PhoneFrameProps = {
  src?: string;
  alt: string;
  label: string;
  fileName?: string;
  className?: string;
  priority?: boolean;
};

export function PhoneFrame({
  src,
  alt,
  label,
  fileName,
  className,
  priority = false,
}: PhoneFrameProps) {
  const hint = fileName ?? src?.split("/").pop() ?? "screenshot.png";

  return (
    <div
      className={cn(
        "relative mx-auto w-[220px] sm:w-[250px] md:w-[280px]",
        className,
      )}
    >
      <div className="phone-shell relative overflow-hidden">
        <div className="phone-notch" />
        <div className="phone-screen">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- local public screenshots
            <img
              src={src}
              alt={alt}
              className="h-full w-full object-cover object-top"
              loading={priority ? "eager" : "lazy"}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-5 text-center">
              <Image
                src={BRAND_LOGO_SRC}
                alt="ORYNO"
                width={48}
                height={48}
                className="rounded-[22%] shadow-[var(--shadow-soft)]"
              />
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Add screenshot
                <br />
                <span className="font-mono text-[10px] text-primary">{hint}</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
