import { cn } from "@/lib/utils";

type AuthFieldProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

export function AuthField({ label, children, className }: AuthFieldProps) {
  return (
    <label className={cn("flex w-full flex-col gap-2", className)}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export const authInputClassName =
  "flex h-12 w-full rounded-[14px] border border-oryno-gray-divider bg-muted/40 px-4 text-base text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground hover:border-oryno-gray-medium/50 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15";
