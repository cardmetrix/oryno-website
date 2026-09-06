"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useCountry } from "@/components/providers/country-provider";
import {
  filterServices,
  getServicesDirectory,
  type ServiceDirectoryItem,
} from "@/lib/services-directory";
import { cn } from "@/lib/utils";

type ServiceSearchProps = {
  className?: string;
  inputClassName?: string;
  placeholder?: string;
};

export function ServiceSearch({
  className,
  inputClassName,
  placeholder = "Search services…",
}: ServiceSearchProps) {
  const router = useRouter();
  const { country } = useCountry();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [services, setServices] = useState<ServiceDirectoryItem[]>(() =>
    getServicesDirectory(country.code),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setServices(getServicesDirectory(country.code));
  }, [country.code]);

  const results = useMemo(() => {
    const available = services.filter((item) => !item.soon);
    if (!query.trim()) {
      return available.slice(0, 8);
    }
    return filterServices(available, { query, category: "All" }).slice(0, 8);
  }, [services, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, results.length]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function goToService(item: ServiceDirectoryItem) {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    router.push(item.href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown" && results.length > 0) {
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) goToService(item);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && (query.trim().length > 0 || results.length > 0);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-controls="service-search-listbox"
        className={cn(
          "h-10 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15",
          inputClassName,
        )}
      />

      {showDropdown ? (
        <div
          id="service-search-listbox"
          role="listbox"
          className="absolute top-[calc(100%+6px)] right-0 z-50 max-h-[min(22rem,70vh)] w-[min(100vw-2rem,22rem)] overflow-y-auto rounded-[16px] border border-border bg-background p-1.5 shadow-[var(--shadow-soft)] sm:w-[22rem]"
        >
          {!query.trim() ? (
            <p className="px-2.5 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Services
            </p>
          ) : null}

          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No services match &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon;
              const active = index === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goToService(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-left transition",
                    active
                      ? "bg-oryno-orange-muted text-foreground"
                      : "hover:bg-muted/70",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.shortDescription}
                    </span>
                  </span>
                  {item.stats ? (
                    <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                      {item.stats}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}

          {query.trim() && results.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/services?q=${encodeURIComponent(query.trim())}`);
              }}
              className="mt-1 w-full rounded-[12px] border border-border px-3 py-2 text-xs font-semibold text-primary transition hover:bg-muted/60"
            >
              View all results for &ldquo;{query.trim()}&rdquo;
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
