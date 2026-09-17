"use client";

import { useCallback, useRef, useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type ContactLike = {
  tel?: string[];
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

function normalizeTel(raw: string) {
  return raw.replace(/[^\d+]/g, "");
}

/** Muted phone input with optional Contact Picker (Android Chrome). */
export function PhoneNumberField({
  value,
  onChange,
  placeholder = "Phone number",
  className,
  inputClassName,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);

  const pickContact = useCallback(async () => {
    const nav = navigator as Navigator & {
      contacts?: {
        select: (
          props: string[],
          opts?: { multiple?: boolean },
        ) => Promise<ContactLike[]>;
      };
    };
    if (!nav.contacts?.select) {
      inputRef.current?.focus();
      return;
    }
    setPicking(true);
    try {
      const contacts = await nav.contacts.select(["tel"], { multiple: false });
      const tel = contacts?.[0]?.tel?.[0];
      if (tel) onChange(normalizeTel(tel));
    } catch {
      // User cancelled or unsupported — ignore.
    } finally {
      setPicking(false);
    }
  }, [onChange]);

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-14 w-full rounded-2xl border-0 bg-muted px-4 pr-14 text-[15px] font-medium text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:bg-muted focus:ring-2 focus:ring-primary/25",
          inputClassName,
        )}
      />
      <button
        type="button"
        onClick={pickContact}
        disabled={picking}
        aria-label="Pick from contacts"
        title="Pick from contacts"
        className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-background hover:text-primary disabled:opacity-60"
      >
        <UserRoundPlus className="h-5 w-5" strokeWidth={1.85} />
      </button>
    </div>
  );
}
