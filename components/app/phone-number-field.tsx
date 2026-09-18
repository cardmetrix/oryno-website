"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type ContactLike = {
  tel?: string[];
};

export type BeneficiaryOption = {
  id: string;
  phone: string;
  label: string | null;
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

/** Phone input with saved beneficiaries dropdown + optional device contacts. */
export function PhoneNumberField({
  value,
  onChange,
  placeholder = "Phone number",
  className,
  inputClassName,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryOption[]>([]);
  const loaded = useRef(false);

  const loadBeneficiaries = useCallback(async () => {
    if (loaded.current) return;
    setLoading(true);
    try {
      const res = await fetch("/api/beneficiaries", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { items?: BeneficiaryOption[] };
      setBeneficiaries(json.items ?? []);
      loaded.current = true;
    } catch {
      // Ignore — picker still works for typing / device contacts.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

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
      setOpen(false);
      return;
    }
    setPicking(true);
    setOpen(false);
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

  async function togglePicker() {
    const next = !open;
    setOpen(next);
    if (next) await loadBeneficiaries();
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
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
        onClick={() => void togglePicker()}
        disabled={picking}
        aria-label="Choose beneficiary"
        aria-expanded={open}
        title="Saved beneficiaries"
        className="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-background hover:text-primary disabled:opacity-60"
      >
        <UserRoundPlus className="h-5 w-5" strokeWidth={1.85} />
      </button>

      {open ? (
        <div className="absolute top-[calc(100%+6px)] right-0 z-40 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-md)] sm:min-w-[20rem]">
          <div className="border-b border-border px-3.5 py-2.5">
            <p className="text-xs font-semibold text-muted-foreground">
              Saved beneficiaries
            </p>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {loading ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : beneficiaries.length === 0 ? (
              <div className="space-y-2 px-3 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No saved beneficiaries yet
                </p>
                <button
                  type="button"
                  onClick={() => void pickContact()}
                  className="text-xs font-semibold text-primary"
                >
                  Pick from contacts
                </button>
              </div>
            ) : (
              <>
                {beneficiaries.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onChange(item.phone);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition hover:bg-muted",
                      value === item.phone && "bg-oryno-orange-muted",
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {item.label?.trim() || item.phone}
                    </span>
                    {item.label?.trim() ? (
                      <span className="text-xs text-muted-foreground">
                        {item.phone}
                      </span>
                    ) : null}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void pickContact()}
                  className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-primary hover:bg-muted"
                >
                  Pick from contacts
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
