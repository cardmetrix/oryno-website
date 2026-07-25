import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  children: React.ReactNode;
  className?: string;
  showLogo?: boolean;
};

export function AuthShell({
  children,
  className,
  showLogo = true,
}: AuthShellProps) {
  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <div
        className={cn(
          "mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-6 pb-8 pt-10 sm:px-8",
          className,
        )}
      >
        {showLogo ? (
          <div className="mb-8">
            <BrandLogo size={44} priority className="shadow-[var(--shadow-orange)]" />
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
