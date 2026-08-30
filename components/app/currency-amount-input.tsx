import { cn } from "@/lib/utils";

type Props = {
  prefix: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  className?: string;
  inputClassName?: string;
};

/** Amount field with a currency prefix that never overlaps the digits. */
export function CurrencyAmountInput({
  prefix,
  value,
  onChange,
  min,
  className,
  inputClassName,
}: Props) {
  return (
    <div
      className={cn(
        "flex h-12 items-center rounded-[14px] border border-border bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15",
        className,
      )}
    >
      <span className="shrink-0 pl-4 text-sm font-semibold text-muted-foreground">
        {prefix}
      </span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-w-0 flex-1 bg-transparent py-2 pr-4 pl-2 text-sm outline-none",
          inputClassName,
        )}
      />
    </div>
  );
}

export function CurrencyPresetButton({
  prefix,
  amount,
  active,
  onClick,
}: {
  prefix: string;
  amount: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-semibold",
        active ? "bg-primary text-white" : "bg-muted text-foreground",
      )}
    >
      <span>{prefix}</span>
      <span>{amount}</span>
    </button>
  );
}
